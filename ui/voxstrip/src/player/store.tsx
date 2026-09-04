// PlayerProvider owns the playback queue and the audio engine for the whole
// app. It persists queue and settings to localStorage, republishes state to
// stage windows over a BroadcastChannel, and exposes everything through the
// usePlayer() hook.

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
} from 'react';
import type { JsonValue } from '@bufbuild/protobuf';
import { ProcessingStatus, songFromJSON, songToJSON, type Song } from '../api/client';
import { loadJSON, saveJSON } from '../lib/storage';
import { PlayerEngine, type EngineState, type PlayMode } from './engine';
import { openStageChannel, type StageMessage } from './broadcast';

export interface QueueItem {
  song: Song;
  // Stable identity for list keys and reordering; songs may repeat in a queue.
  queueId: string;
}

export interface PlayerContextValue {
  queue: QueueItem[];
  currentIndex: number;
  currentSong: Song | null;
  engine: EngineState;
  mode: PlayMode;
  volume: number;
  vocalLevel: number;
  lyricsOffsetMs: number;

  addToQueue: (song: Song) => void;
  playNow: (song: Song) => void;
  playAt: (index: number) => void;
  removeAt: (index: number) => void;
  moveItem: (from: number, to: number) => void;
  clearQueue: () => void;
  next: () => void;
  previous: () => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  seekBy: (deltaSeconds: number) => void;
  setVolume: (volume: number) => void;
  setVocalLevel: (level: number) => void;
  setMode: (mode: PlayMode) => void;
  setLyricsOffsetMs: (offsetMs: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// Single engine for the whole window; the provider wires and unwires its
// callbacks so StrictMode remounts stay safe.
const engine = new PlayerEngine();

interface PersistedQueue {
  songs: JsonValue[];
  currentIndex: number;
}

interface PersistedSettings {
  volume: number;
  vocalLevel: number;
  mode: PlayMode;
}

const IDLE_ENGINE_STATE: EngineState = {
  isPlaying: false,
  isLoading: false,
  currentTime: 0,
  duration: 0,
  error: null,
};

function restoreQueue(): { queue: QueueItem[]; currentIndex: number } {
  const persisted = loadJSON<PersistedQueue>('queue');
  if (!persisted) return { queue: [], currentIndex: -1 };

  const queue: QueueItem[] = [];
  for (const json of persisted.songs) {
    const song = songFromJSON(json);
    if (song) queue.push({ song, queueId: crypto.randomUUID() });
  }
  const currentIndex = queue.length > 0 ? Math.min(Math.max(persisted.currentIndex, 0), queue.length - 1) : -1;
  return { queue, currentIndex };
}

function restoreSettings(): PersistedSettings {
  const persisted = loadJSON<PersistedSettings>('settings');
  return {
    volume: persisted?.volume ?? 1,
    vocalLevel: persisted?.vocalLevel ?? 0,
    mode: persisted?.mode === 'original' ? 'original' : 'stems',
  };
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>(() => restoreQueue().queue);
  const [currentIndex, setCurrentIndex] = useState(() => restoreQueue().currentIndex);
  const [engineState, setEngineState] = useState<EngineState>(IDLE_ENGINE_STATE);
  const [settings] = useState(restoreSettings);
  const [mode, setModeState] = useState<PlayMode>(settings.mode);
  const [volume, setVolumeState] = useState(settings.volume);
  const [vocalLevel, setVocalLevelState] = useState(settings.vocalLevel);
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0);

  const currentSong = currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex].song : null;

  // Refs mirror state for engine callbacks and event handlers, which run
  // outside render and always need the latest values.
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);
  const offsetRef = useRef(lyricsOffsetMs);
  const autoplayRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    queueRef.current = queue;
    indexRef.current = currentIndex;
    offsetRef.current = lyricsOffsetMs;
  }, [queue, currentIndex, lyricsOffsetMs]);

  // Wire the singleton engine's callbacks; they fire on audio events, never
  // during render.
  useEffect(() => {
    engine.onChange = (state) => setEngineState(state);
    engine.onEnded = () => {
      // Natural track end: advance, or stop at the end of the queue.
      if (indexRef.current < queueRef.current.length - 1) {
        autoplayRef.current = true;
        setLyricsOffsetMs(0);
        setCurrentIndex(indexRef.current + 1);
      }
    };
    engine.setVolume(settings.volume);
    engine.setVocalLevel(settings.vocalLevel);
    return () => {
      engine.onChange = null;
      engine.onEnded = null;
      engine.unload();
    };
  }, [settings]);

  // Load the engine whenever the current song or mode changes. Autoplay only
  // when a user action asked for it; restoring from storage stays paused.
  useEffect(() => {
    if (!currentSong) {
      engine.unload();
      return;
    }
    engine.load(currentSong.songId, mode, { autoplay: autoplayRef.current });
    autoplayRef.current = false;
  }, [currentSong, mode]);

  // Persistence.
  useEffect(() => {
    saveJSON('queue', {
      songs: queue.map((item) => songToJSON(item.song)),
      currentIndex,
    } satisfies PersistedQueue);
  }, [queue, currentIndex]);

  useEffect(() => {
    saveJSON('settings', { volume, vocalLevel, mode } satisfies PersistedSettings);
  }, [volume, vocalLevel, mode]);

  // Stage window broadcasting.
  const publishState = useCallback(() => {
    const song = indexRef.current >= 0 ? queueRef.current[indexRef.current]?.song : null;
    const state = engine.state;
    channelRef.current?.postMessage({
      type: 'state',
      song: song
        ? {
            songId: song.songId,
            title: song.metadata?.title || 'Unknown Title',
            artist: song.metadata?.artist || 'Unknown Artist',
            lyrics: song.metadata?.lyrics || '',
          }
        : null,
      isPlaying: state.isPlaying,
      currentTime: state.currentTime,
      duration: state.duration,
      lyricsOffsetMs: offsetRef.current,
    } satisfies StageMessage);
  }, []);

  useEffect(() => {
    if (!('BroadcastChannel' in globalThis)) return;
    const channel = openStageChannel();
    channelRef.current = channel;
    const onMessage = (event: MessageEvent<StageMessage>) => {
      if (event.data.type === 'hello') publishState();
    };
    channel.addEventListener('message', onMessage);
    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [publishState]);

  useEffect(() => {
    publishState();
  }, [publishState, engineState, currentSong, lyricsOffsetMs]);

  // Actions. These run from user events, so reading the state snapshot from
  // render scope is accurate and keeps updaters pure.
  const addToQueue = useCallback(
    (song: Song) => {
      if (song.processingStatus !== ProcessingStatus.COMPLETED) return;
      setQueue([...queueRef.current, { song, queueId: crypto.randomUUID() }]);
      if (indexRef.current === -1) setCurrentIndex(0);
    },
    [],
  );

  const playAt = useCallback(
    (index: number) => {
      if (index < 0 || index >= queueRef.current.length) return;
      if (index === indexRef.current) {
        engine.play();
        return;
      }
      autoplayRef.current = true;
      setLyricsOffsetMs(0);
      setCurrentIndex(index);
    },
    [],
  );

  const playNow = useCallback((song: Song) => {
    if (song.processingStatus !== ProcessingStatus.COMPLETED) return;
    autoplayRef.current = true;
    setLyricsOffsetMs(0);
    setQueue([...queueRef.current, { song, queueId: crypto.randomUUID() }]);
    setCurrentIndex(queueRef.current.length);
  }, []);

  const removeAt = useCallback((index: number) => {
    const current = queueRef.current;
    if (index < 0 || index >= current.length) return;
    const next = current.filter((_, i) => i !== index);
    setQueue(next);

    const currentIdx = indexRef.current;
    if (next.length === 0) {
      setCurrentIndex(-1);
    } else if (index < currentIdx) {
      setCurrentIndex(currentIdx - 1);
    } else if (index === currentIdx) {
      setCurrentIndex(Math.min(currentIdx, next.length - 1));
    }
  }, []);

  const moveItem = useCallback((from: number, to: number) => {
    const current = queueRef.current;
    if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) return;
    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setQueue(next);

    const currentIdx = indexRef.current;
    if (from === currentIdx) {
      setCurrentIndex(to);
    } else if (from < currentIdx && to >= currentIdx) {
      setCurrentIndex(currentIdx - 1);
    } else if (from > currentIdx && to <= currentIdx) {
      setCurrentIndex(currentIdx + 1);
    }
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(-1);
  }, []);

  const next = useCallback(() => playAt(indexRef.current + 1), [playAt]);
  const previous = useCallback(() => playAt(indexRef.current - 1), [playAt]);

  const togglePlay = useCallback(() => {
    if (indexRef.current === -1) {
      playAt(0);
      return;
    }
    if (engine.state.isPlaying) {
      engine.pause();
    } else {
      engine.play();
    }
  }, [playAt]);

  const seek = useCallback((seconds: number) => engine.seek(seconds), []);
  const seekBy = useCallback((delta: number) => engine.seekBy(delta), []);

  const setVolume = useCallback(
    (value: number) => {
      setVolumeState(value);
      engine.setVolume(value);
    },
    [],
  );

  const setVocalLevel = useCallback(
    (value: number) => {
      setVocalLevelState(value);
      engine.setVocalLevel(value);
    },
    [],
  );

  const setMode = useCallback((value: PlayMode) => setModeState(value), []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      currentIndex,
      currentSong,
      engine: engineState,
      mode,
      volume,
      vocalLevel,
      lyricsOffsetMs,
      addToQueue,
      playNow,
      playAt,
      removeAt,
      moveItem,
      clearQueue,
      next,
      previous,
      togglePlay,
      seek,
      seekBy,
      setVolume,
      setVocalLevel,
      setMode,
      setLyricsOffsetMs,
    }),
    [
      queue,
      currentIndex,
      currentSong,
      engineState,
      mode,
      volume,
      vocalLevel,
      lyricsOffsetMs,
      addToQueue,
      playNow,
      playAt,
      removeAt,
      moveItem,
      clearQueue,
      next,
      previous,
      togglePlay,
      seek,
      seekBy,
      setVolume,
      setVocalLevel,
      setMode,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
}
