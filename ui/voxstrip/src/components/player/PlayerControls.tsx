import {
  DownloadIcon,
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react';
import type { AudioPlayerActions, AudioPlayerState } from '../../hooks/useAudioPlayer.js';
import { formatTime } from '../../utils/formatters.js';

type PlayerControlsProps = {
  audioPlayer: AudioPlayerState & AudioPlayerActions;
  onNext: () => void;
  onPrevious: () => void;
  onPlayPause: () => void;
  onDownload: () => void;
  canSkipBackward: boolean;
  canSkipForward: boolean;
};

export default function PlayerControls({
  audioPlayer,
  onNext,
  onPrevious,
  onPlayPause,
  onDownload,
  canSkipBackward,
  canSkipForward,
}: PlayerControlsProps) {
  const handleVolumeToggle = () => {
    if (audioPlayer.volume > 0) {
      audioPlayer.setVolume(0);
    } else {
      audioPlayer.setVolume(1);
    }
  };

  const trackDuration = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : 0;
  const currentTime = Math.min(audioPlayer.currentTime, trackDuration);

  return (
    <div className="card preset-tonal-surface p-6 space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-surface-600-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(trackDuration)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={trackDuration}
          value={currentTime}
          onChange={(event) => audioPlayer.seek(Number(event.target.value))}
          className="w-full h-2 bg-surface-200-800 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          onClick={onPrevious}
          disabled={!canSkipBackward}
          className="btn preset-outline"
        >
          <SkipBackIcon size={24} />
        </button>

        <button
          onClick={onPlayPause}
          className="btn preset-filled w-16 h-16 rounded-full flex items-center justify-center"
        >
          {audioPlayer.isPlaying ? <PauseIcon size={32} /> : <PlayIcon size={32} />}
        </button>

        <button
          onClick={onNext}
          disabled={!canSkipForward}
          className="btn preset-outline"
        >
          <SkipForwardIcon size={24} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleVolumeToggle}
          className="btn preset-ghost flex items-center gap-2"
        >
          {audioPlayer.volume > 0 ? (
            <Volume2Icon size={16} />
          ) : (
            <VolumeXIcon size={16} />
          )}
          {Math.round(audioPlayer.volume * 100)}%
        </button>

        <div className="flex-1"></div>

        <input
          type="range"
          min="0.25"
          max="2"
          step="0.25"
          value={audioPlayer.playbackRate}
          onChange={(event) => audioPlayer.setPlaybackRate(Number(event.target.value))}
          className="w-20 h-1 bg-surface-200-800 rounded-lg appearance-none cursor-pointer"
          title="Playback Speed"
        />
        <span className="text-xs text-surface-600-400">{audioPlayer.playbackRate}x</span>

        <button
          onClick={onDownload}
          className="btn preset-ghost flex items-center gap-2"
          disabled={!audioPlayer.currentSong || audioPlayer.isLoading}
        >
          <DownloadIcon size={16} />
          Download
        </button>
      </div>
    </div>
  );
}
