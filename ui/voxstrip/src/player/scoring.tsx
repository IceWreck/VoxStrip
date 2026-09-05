// ScoringProvider owns the live singing-score session: microphone capture,
// the reference pitch track for the current song, and the ScoringSession
// that grades samples. All high-frequency work happens in the mic sample
// handler against refs; React state updates are throttled to a few per
// second, and score state is republished to stage windows.

/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { fetchPitchTrack, type PitchNote } from '../lib/pitchTrack';
import { MicPitchMonitor } from '../lib/micPitch';
import { parseLyrics } from '../lib/lyrics';
import { ScoringSession, type FinishedLine, type ScoreSnapshot, type ScoreSummary, type SampleState } from '../lib/scoring';
import { loadJSON, saveJSON } from '../lib/storage';
import { openStageChannel, type StageMessage } from './broadcast';
import { usePlayback, usePlayer } from './store';

// Default compensation for output + mic latency: the singer hears the music
// late and the mic reading arrives late, so a sample at engine time t was
// aimed at a slightly earlier song position.
const DEFAULT_MIC_OFFSET_MS = 100;

// How often live score state is pushed into React and to stage windows.
const SNAPSHOT_INTERVAL_MS = 250;

// A song counts as finished for the score summary when playback gets within
// this many seconds of the end.
const SONG_END_WINDOW_SECONDS = 0.4;

export interface TraceSample {
  time: number;
  midi: number | null;
  state: SampleState;
}

// LaneData is mutable shared state for the canvas pitch lane, read every
// animation frame without going through React.
export interface LaneData {
  notes: PitchNote[];
  trace: TraceSample[];
  songTime: () => number;
}

export interface ScoringContextValue {
  // True when the mic is live and samples are being scored.
  enabled: boolean;
  // True when the current song has a reference pitch track.
  available: boolean;
  micError: string | null;
  live: ScoreSnapshot | null;
  lastFinished: (FinishedLine & { key: number }) | null;
  summary: ScoreSummary | null;
  micOffsetMs: number;

  enable: () => Promise<void>;
  disable: () => void;
  dismissSummary: () => void;
  setMicOffsetMs: (offsetMs: number) => void;
  laneRef: RefObject<LaneData>;
}

const ScoringContext = createContext<ScoringContextValue | null>(null);

interface PersistedScoring {
  micOffsetMs: number;
}

export function ScoringProvider({ children }: { children: ReactNode }) {
  const { currentSong, lyricsOffsetMs } = usePlayer();
  const playback = usePlayback();
  const songId = currentSong?.songId ?? null;

  const [enabled, setEnabled] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  // Track, live score, and line flashes are tagged with the song they belong
  // to so a song change invalidates them without effect-time state resets.
  const [track, setTrack] = useState<{ songId: string; notes: PitchNote[] | null } | null>(null);
  const [liveState, setLiveState] = useState<{ songId: string; snapshot: ScoreSnapshot } | null>(null);
  const [lastFinishedState, setLastFinishedState] = useState<{
    songId: string;
    line: FinishedLine & { key: number };
  } | null>(null);
  const [summary, setSummary] = useState<ScoreSummary | null>(null);
  const [micOffsetMs, setMicOffsetMsState] = useState(
    () => loadJSON<PersistedScoring>('scoring')?.micOffsetMs ?? DEFAULT_MIC_OFFSET_MS,
  );

  const notes = track && track.songId === songId ? track.notes : null;
  const live = liveState && liveState.songId === songId ? liveState.snapshot : null;
  const lastFinished = lastFinishedState && lastFinishedState.songId === songId ? lastFinishedState.line : null;

  const monitorRef = useRef<MicPitchMonitor | null>(null);
  const sessionRef = useRef<ScoringSession | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastEmitRef = useRef(0);
  const finishedCountRef = useRef(0);
  const summaryDoneRef = useRef(false);
  const micOffsetRef = useRef(micOffsetMs);
  const songIdRef = useRef(songId);

  // Playback position is interpolated between the engine's ~4Hz updates so
  // 30+ mic samples a second land on a smooth clock.
  const playbackRef = useRef({ currentTime: 0, duration: 0, isPlaying: false, atMs: 0 });
  useEffect(() => {
    playbackRef.current = {
      currentTime: playback.currentTime,
      duration: playback.duration,
      isPlaying: playback.isPlaying,
      atMs: performance.now(),
    };
  }, [playback]);

  useEffect(() => {
    micOffsetRef.current = micOffsetMs;
    songIdRef.current = songId;
  }, [micOffsetMs, songId]);

  const laneRef = useRef<LaneData>({
    notes: [],
    trace: [],
    songTime: () => {
      const p = playbackRef.current;
      const elapsed = p.isPlaying ? (performance.now() - p.atMs) / 1000 : 0;
      return Math.min(p.currentTime + elapsed, p.duration || Infinity);
    },
  });

  useEffect(() => {
    if (!('BroadcastChannel' in globalThis)) return;
    const channel = openStageChannel();
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const broadcast = useCallback((snapshot: ScoreSnapshot | null, finished: boolean) => {
    channelRef.current?.postMessage({
      type: 'score',
      active: snapshot !== null,
      score: snapshot?.score ?? 0,
      combo: snapshot?.combo ?? 0,
      accuracy: snapshot?.accuracy ?? 0,
      lastLine: null,
      finished,
    } satisfies StageMessage);
  }, []);

  // Load the reference track whenever the current song changes.
  useEffect(() => {
    if (!songId) return;
    const controller = new AbortController();
    fetchPitchTrack(songId, controller.signal)
      .then((result) => setTrack({ songId, notes: result?.notes ?? null }))
      .catch(() => setTrack({ songId, notes: null }));
    return () => controller.abort();
  }, [songId]);

  // (Re)build the scoring session when the song, its track, or mic state
  // changes. Only refs are touched here; tagged state above goes stale on
  // its own. Lyric times are pre-shifted by the effective lyrics offset so
  // scored lines match what the singer sees.
  const rawLyrics = currentSong?.metadata?.lyrics;
  useEffect(() => {
    sessionRef.current = null;
    finishedCountRef.current = 0;
    summaryDoneRef.current = false;
    const lane = laneRef.current;
    lane.trace.length = 0;
    lane.notes = notes ?? [];
    if (!enabled || !notes || notes.length === 0) return;

    const lyrics = parseLyrics(rawLyrics);
    const shiftSeconds = (lyrics.offsetMs + lyricsOffsetMs) / 1000;
    const shifted = {
      ...lyrics,
      lines: lyrics.lines.map((line) => (line.time === null ? line : { ...line, time: line.time - shiftSeconds })),
    };
    sessionRef.current = new ScoringSession(notes, shifted);
    // lyricsOffsetMs is deliberately omitted: the nudge buttons repeat
    // quickly and rebuilding would wipe an in-flight session. The offset
    // captured at session start is well within scoring's timing window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, notes, rawLyrics]);

  // Feed mic samples into the session. Everything per-sample happens against
  // refs; React state is only touched a few times a second.
  useEffect(() => {
    const monitor = monitorRef.current;
    if (!enabled || !monitor) return;

    monitor.onSample = (sample) => {
      const session = sessionRef.current;
      const lane = laneRef.current;
      const currentSongId = songIdRef.current;
      const now = lane.songTime();
      const scoredTime = now - micOffsetRef.current / 1000;
      const p = playbackRef.current;

      let state: SampleState = 'rest';
      if (session && p.isPlaying) {
        state = session.addSample(scoredTime, sample.midi).state;
      }
      lane.trace.push({ time: scoredTime, midi: sample.midi, state });
      while (lane.trace.length > 0 && lane.trace[0].time < now - 10) lane.trace.shift();

      if (!session || !currentSongId) return;

      // Song end: freeze the session into a summary exactly once.
      if (!summaryDoneRef.current && p.duration > 0 && p.currentTime >= p.duration - SONG_END_WINDOW_SECONDS) {
        summaryDoneRef.current = true;
        setSummary(session.summary());
        const snapshot = session.snapshot();
        setLiveState({ songId: currentSongId, snapshot });
        broadcast(snapshot, true);
        return;
      }

      if (sample.atMs - lastEmitRef.current < SNAPSHOT_INTERVAL_MS) return;
      lastEmitRef.current = sample.atMs;
      const snapshot = session.snapshot();
      setLiveState({ songId: currentSongId, snapshot });
      broadcast(snapshot, false);
      if (snapshot.finishedLines.length !== finishedCountRef.current) {
        finishedCountRef.current = snapshot.finishedLines.length;
        const last = snapshot.finishedLines[snapshot.finishedLines.length - 1];
        if (last) setLastFinishedState({ songId: currentSongId, line: { ...last, key: sample.atMs } });
      }
    };
    return () => {
      monitor.onSample = null;
    };
  }, [enabled, broadcast]);

  const enable = useCallback(async () => {
    if (monitorRef.current) return;
    setMicError(null);
    try {
      monitorRef.current = await MicPitchMonitor.open();
      setEnabled(true);
    } catch (error) {
      setMicError(error instanceof Error ? error.message : 'microphone unavailable');
    }
  }, []);

  const disable = useCallback(() => {
    monitorRef.current?.close();
    monitorRef.current = null;
    setEnabled(false);
    setLiveState(null);
    setSummary(null);
    broadcast(null, false);
  }, [broadcast]);

  // Release the mic when the provider unmounts.
  useEffect(() => {
    return () => {
      monitorRef.current?.close();
      monitorRef.current = null;
    };
  }, []);

  const dismissSummary = useCallback(() => setSummary(null), []);

  const setMicOffsetMs = useCallback((offsetMs: number) => {
    setMicOffsetMsState(offsetMs);
    saveJSON('scoring', { micOffsetMs: offsetMs } satisfies PersistedScoring);
  }, []);

  const value = useMemo<ScoringContextValue>(
    () => ({
      enabled,
      available: notes !== null && notes.length > 0,
      micError,
      live,
      lastFinished,
      summary,
      micOffsetMs,
      enable,
      disable,
      dismissSummary,
      setMicOffsetMs,
      laneRef,
    }),
    [enabled, notes, micError, live, lastFinished, summary, micOffsetMs, enable, disable, dismissSummary, setMicOffsetMs],
  );

  return <ScoringContext.Provider value={value}>{children}</ScoringContext.Provider>;
}

export function useScoring(): ScoringContextValue {
  const context = useContext(ScoringContext);
  if (!context) throw new Error('useScoring must be used within ScoringProvider');
  return context;
}
