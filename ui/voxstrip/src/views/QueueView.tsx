import { useState } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  SkipForwardIcon, 
  SkipBackIcon, 
  Trash2Icon,
  GripVerticalIcon,
  Volume2Icon,
  VolumeXIcon
} from 'lucide-react';
import { useQueue } from '../hooks/useQueue.js';
import { useAudioPlayer } from '../hooks/useAudioPlayer.js';
import { VoxStripAPI } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.js';

interface QueueViewProps {
  queue: ReturnType<typeof useQueue>;
  audioPlayer: ReturnType<typeof useAudioPlayer>;
}

export default function QueueView({ queue, audioPlayer }: QueueViewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handlePlayPause = () => {
    if (!audioPlayer.currentSong) {
      // If no song loaded, play first in queue
      if (queue.items.length > 0) {
        queue.jumpToIndex(0);
      }
    } else {
      audioPlayer.togglePlayPause();
    }
  };

  const handleNext = () => {
    queue.playNext();
  };

  const handlePrevious = () => {
    queue.playPrevious();
  };

  const handleVolumeToggle = () => {
    if (audioPlayer.volume > 0) {
      audioPlayer.setVolume(0);
    } else {
      audioPlayer.setVolume(1);
    }
  };

  const handleClearQueue = () => {
    queue.clearQueue();
  };

  const formatDuration = (durationMs?: number): string => {
    if (!durationMs) return '--:--';
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      queue.moveInQueue(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="h2">Queue</h1>
          <p className="text-surface-600-400">
            {queue.items.length} {queue.items.length === 1 ? 'song' : 'songs'} in queue
          </p>
        </div>
        
        {queue.items.length > 0 && (
          <button
            onClick={handleClearQueue}
            className="btn preset-outline flex items-center gap-2"
          >
            <Trash2Icon size={16} />
            Clear Queue
          </button>
        )}
      </div>

      {/* Now Playing Section */}
      {audioPlayer.currentSong && (
        <div className="card preset-tonal-primary p-6 space-y-4">
          <div className="flex items-center gap-4">
            {/* Album Art */}
            <div className="relative">
              <img
                src={VoxStripAPI.getCoverArtUrl(audioPlayer.currentSong.songId)}
                alt={audioPlayer.currentSong.metadata?.title || 'Unknown Title'}
                className="w-16 h-16 rounded-lg object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-album.png';
                }}
              />
            </div>
            
            {/* Song Info */}
            <div className="flex-1">
              <h3 className="h4 font-bold">
                {audioPlayer.currentSong.metadata?.title || 'Unknown Title'}
              </h3>
              <p className="text-surface-600-400">
                {audioPlayer.currentSong.metadata?.artist || 'Unknown Artist'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={audioPlayer.currentSong.processingStatus} showIcon={false} />
              </div>
            </div>

            {/* Playing Indicator */}
            <div className="flex items-center gap-2">
              {audioPlayer.isPlaying && (
                <div className="flex items-center gap-1">
                  <div className="w-1 h-4 bg-primary-500 animate-pulse"></div>
                  <div className="w-1 h-4 bg-primary-500 animate-pulse delay-75"></div>
                  <div className="w-1 h-4 bg-primary-500 animate-pulse delay-150"></div>
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-surface-600-400">
              <span>{formatTime(audioPlayer.currentTime)}</span>
              <span>{formatTime(audioPlayer.duration)}</span>
            </div>
            <input
              type="range"
              min="0"
              max={audioPlayer.duration || 0}
              value={audioPlayer.currentTime}
              onChange={(e) => audioPlayer.seek(Number(e.target.value))}
              className="w-full h-2 bg-surface-200-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={queue.currentIndex <= 0}
              className="btn preset-outline"
            >
              <SkipBackIcon size={16} />
            </button>
            
            <button
              onClick={handlePlayPause}
              className="btn preset-filled flex items-center gap-2"
            >
              {audioPlayer.isPlaying ? (
                <PauseIcon size={16} />
              ) : (
                <PlayIcon size={16} />
              )}
              {audioPlayer.isPlaying ? 'Pause' : 'Play'}
            </button>
            
            <button
              onClick={handleNext}
              disabled={queue.currentIndex >= queue.items.length - 1}
              className="btn preset-outline"
            >
              <SkipForwardIcon size={16} />
            </button>

            <div className="flex-1"></div>

            {/* Volume Control */}
            <button
              onClick={handleVolumeToggle}
              className="btn preset-outline flex items-center gap-2"
            >
              {audioPlayer.volume > 0 ? (
                <Volume2Icon size={16} />
              ) : (
                <VolumeXIcon size={16} />
              )}
              {Math.round(audioPlayer.volume * 100)}%
            </button>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="space-y-2">
        <h2 className="h3">Upcoming</h2>
        
        {queue.items.length === 0 ? (
          <div className="card preset-tonal-surface p-8 text-center">
            <div className="text-surface-400-600 mb-2">
              Your queue is empty
            </div>
            <p className="text-sm text-surface-500-500">
              Add songs from Songs view to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.items.map((queueItem, index) => {
              const isCurrent = index === queue.currentIndex;
              const isUpcoming = index > queue.currentIndex;
              const isPlayed = index < queue.currentIndex;
              
              return (
                <div
                  key={`${queueItem.song.songId}-${queueItem.addedAt.getTime()}`}
                  className={`card p-4 transition-all cursor-move ${
                    isCurrent 
                      ? 'preset-tonal-primary ring-2 ring-primary-500' 
                      : isUpcoming 
                      ? 'preset-filled-surface-100-900 hover:preset-tonal-surface'
                      : 'preset-filled-surface-50-950 opacity-60'
                  }`}
                  draggable={!isCurrent && !isPlayed}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <div className="flex items-center gap-3">
                    {/* Drag Handle */}
                    {!isCurrent && !isPlayed && (
                      <GripVerticalIcon size={16} className="text-surface-400-600" />
                    )}

                    {/* Play Indicator */}
                    {isCurrent && (
                      <div className="flex items-center gap-1">
                        {audioPlayer.isPlaying ? (
                          <PauseIcon size={16} className="text-primary-600" />
                        ) : (
                          <PlayIcon size={16} className="text-primary-600" />
                        )}
                      </div>
                    )}

                    {/* Album Art */}
                    <img
                      src={VoxStripAPI.getCoverArtUrl(queueItem.song.songId)}
                      alt={queueItem.song.metadata?.title || 'Unknown Title'}
                      className="w-10 h-10 rounded object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-album.png';
                      }}
                    />

                    {/* Song Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium truncate ${
                        isCurrent ? 'text-primary-600' : ''
                      }`}>
                        {queueItem.song.metadata?.title || 'Unknown Title'}
                      </h4>
                      <p className="text-sm text-surface-600-400 truncate">
                        {queueItem.song.metadata?.artist || 'Unknown Artist'}
                      </p>
                    </div>

                    {/* Duration */}
                    <div className="text-sm text-surface-600-400">
                      {formatDuration(Number(queueItem.song.durationMs))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!isCurrent && (
                        <button
                          onClick={() => queue.jumpToIndex(index)}
                          className="btn preset-ghost"
                        >
                          Play
                        </button>
                      )}
                      
                      <button
                        onClick={() => queue.removeFromQueue(index)}
                        disabled={isCurrent}
                        className="btn preset-ghost"
                      >
                        <Trash2Icon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Error Display */}
      {audioPlayer.error && (
        <div className="card preset-tonal-error p-4">
          <p className="font-medium">Playback Error</p>
          <p className="text-sm">{audioPlayer.error}</p>
        </div>
      )}
    </div>
  );
}