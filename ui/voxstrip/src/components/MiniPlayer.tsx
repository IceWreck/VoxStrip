import { Link } from '@tanstack/react-router';
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';
import { usePlayback, usePlayer } from '../player/store';
import { formatTime } from '../lib/format';
import CoverArt from './CoverArt';
import PlayerSlider from './PlayerSlider';

// MiniPlayer is the persistent now-playing bar shown at the bottom of every
// library view, so playback stays controllable while browsing.
export default function MiniPlayer() {
  const player = usePlayer();
  const playback = usePlayback();
  const { currentSong } = player;

  if (!currentSong) return null;

  return (
    <div className="flex items-center gap-3 border-t border-surface-200-800 bg-surface-100-900 px-3 py-2 sm:gap-4 sm:px-4">
      <Link to="/player" className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none sm:basis-64">
        <CoverArt
          key={currentSong.songId}
          songId={currentSong.songId}
          alt={currentSong.metadata?.title || 'cover'}
          className="size-10 shrink-0 rounded-base"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{currentSong.metadata?.title || 'Unknown Title'}</p>
          <p className="truncate text-xs text-surface-600-400">{currentSong.metadata?.artist || 'Unknown Artist'}</p>
        </div>
      </Link>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={player.previous}
          disabled={player.currentIndex <= 0}
          className="btn-icon btn-icon-sm hover:preset-tonal disabled:opacity-40"
          aria-label="Previous song"
        >
          <SkipBackIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={player.togglePlay}
          className="btn-icon preset-filled-primary-500"
          aria-label={playback.isPlaying ? 'Pause' : 'Play'}
        >
          {playback.isPlaying ? <PauseIcon className="size-5" /> : <PlayIcon className="size-5" />}
        </button>
        <button
          type="button"
          onClick={player.next}
          disabled={player.currentIndex >= player.queue.length - 1}
          className="btn-icon btn-icon-sm hover:preset-tonal disabled:opacity-40"
          aria-label="Next song"
        >
          <SkipForwardIcon className="size-4" />
        </button>
      </div>

      <div className="hidden flex-1 items-center gap-3 sm:flex">
        <span className="font-mono text-xs text-surface-600-400">{formatTime(playback.currentTime)}</span>
        <PlayerSlider
          value={playback.currentTime}
          max={playback.duration}
          step={1}
          onChange={player.seek}
          ariaLabel="Seek"
          className="flex-1"
        />
        <span className="font-mono text-xs text-surface-600-400">{formatTime(playback.duration)}</span>
      </div>
    </div>
  );
}
