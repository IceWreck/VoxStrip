import { useEffect, useMemo, useRef, useState } from 'react';
import { MicVocalIcon } from 'lucide-react';
import { openStageChannel, type StageMessage, type StageSong } from '../player/broadcast';
import { activeLineIndex, parseLyrics } from '../lib/lyrics';
import { useCoverColors } from '../lib/useCoverColors';
import { formatTime } from '../lib/format';
import LyricsDisplay from '../components/LyricsDisplay';

interface StageState {
  song: StageSong | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lyricsOffsetMs: number;
  receivedAt: number;
}

interface StageScore {
  active: boolean;
  score: number;
  combo: number;
  accuracy: number;
  finished: boolean;
}

// StageView is the read-only karaoke display for a second window dragged to a
// TV or projector. It renders state broadcast by the main window and owns no
// audio. Click anywhere to toggle fullscreen.
export default function StageView() {
  const [state, setState] = useState<StageState | null>(null);
  const [score, setScore] = useState<StageScore | null>(null);
  // Interpolate playback position between broadcasts for smooth lyric timing.
  const [displayTime, setDisplayTime] = useState(0);
  const stateRef = useRef<StageState | null>(null);

  useEffect(() => {
    const channel = openStageChannel();
    const onMessage = (event: MessageEvent<StageMessage>) => {
      if (event.data.type === 'score') {
        setScore(event.data.active ? event.data : null);
        return;
      }
      if (event.data.type !== 'state') return;
      const next: StageState = { ...event.data, receivedAt: performance.now() };
      stateRef.current = next;
      setState(next);
    };
    channel.addEventListener('message', onMessage);
    channel.postMessage({ type: 'hello' } satisfies StageMessage);
    return () => {
      channel.removeEventListener('message', onMessage);
      channel.close();
    };
  }, []);

  useEffect(() => {
    let frame: number;
    const tick = () => {
      const current = stateRef.current;
      if (current) {
        // Broadcasts arrive several times a second while playing; if they
        // stop (main window closed), freeze instead of extrapolating forever.
        const sinceUpdate = (performance.now() - current.receivedAt) / 1000;
        const elapsed = current.isPlaying ? Math.min(sinceUpdate, 3) : 0;
        setDisplayTime(Math.min(current.currentTime + elapsed, current.duration || Infinity));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const song = state?.song ?? null;
  const colors = useCoverColors(song?.songId ?? null);
  const lyrics = useMemo(() => parseLyrics(song?.lyrics), [song?.lyrics]);
  const activeIndex = activeLineIndex(lyrics, displayTime, state?.lyricsOffsetMs ?? 0);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const progress = state && state.duration > 0 ? Math.min(displayTime / state.duration, 1) : 0;

  return (
    <div className="relative h-screen cursor-pointer select-none overflow-hidden" onClick={toggleFullscreen}>
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[2]})` }}
      />
      <div className="absolute inset-0 bg-black/55" />

      {song ? (
        <>
          {score && (
            <div className="absolute top-8 right-8 z-20 rounded-container bg-black/40 px-6 py-3 text-right text-white backdrop-blur-sm">
              <p className="text-5xl font-black tabular-nums drop-shadow-lg">{score.score}</p>
              <p className="text-lg text-white/70">
                {score.finished ? 'Final score' : score.combo > 1 ? `×${score.combo} streak` : `${Math.round(score.accuracy * 100)}%`}
              </p>
            </div>
          )}
          <div className="relative z-10 flex h-full items-center justify-center p-12">
            <div className="max-h-full w-full max-w-7xl">
              <LyricsDisplay lyrics={lyrics} activeIndex={activeIndex} stage />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 p-8">
            <div className="mb-3 flex items-end justify-between text-white">
              <div>
                <p className="text-3xl font-bold drop-shadow-lg">{song.title}</p>
                <p className="text-xl text-white/70">{song.artist}</p>
              </div>
              <p className="font-mono text-xl text-white/70">
                {formatTime(displayTime)} / {formatTime(state?.duration ?? 0)}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-white/80 transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        </>
      ) : (
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 text-white/80">
          <MicVocalIcon className="size-24 animate-pulse" />
          <p className="text-4xl font-bold">VoxStrip</p>
          <p className="text-xl text-white/60">Waiting for the player… start a song in the main window.</p>
        </div>
      )}
    </div>
  );
}
