import { useState, type DragEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Trash2Icon, GripVerticalIcon, PlayIcon, PauseIcon, SkipForwardIcon } from 'lucide-react';
import { Avatar, Progress } from '@skeletonlabs/skeleton-react';
import { useAppContext } from '../router/context.js';
import { useCoverArtCache, useBatchCoverArtLoader } from '../hooks/useCoverArtCache.js';
import { formatDuration } from '../utils/formatters.js';

export default function QueueView() {
  const { queue, audioPlayer } = useAppContext();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const songIds = queue.items.map(item => item.song.songId);
  const coverArtCache = useCoverArtCache({ cleanupOnUnmount: false });
  useBatchCoverArtLoader(songIds, coverArtCache);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (dropIndex: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    queue.moveInQueue(draggedIndex, dropIndex);
    setDraggedIndex(null);
  };

  const handleClearQueue = () => {
    queue.clearQueue();
  };

  const currentSong = queue.currentSong;
  const upcomingSongs = queue.items.filter((_, index) => index > queue.currentIndex);
  const playedSongs = queue.items.filter((_, index) => index < queue.currentIndex);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="h2">Queue</h1>
          <p className="text-surface-600-400">
            {queue.items.length} {queue.items.length === 1 ? 'song' : 'songs'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/player" className="btn preset-filled flex items-center gap-2">
            <PlayIcon className="w-4 h-4" />
            Open Player
          </Link>
          {queue.items.length > 0 && (
            <button onClick={handleClearQueue} className="btn preset-outline flex items-center gap-2">
              <Trash2Icon className="w-4 h-4" />
              Clear Queue
            </button>
          )}
        </div>
      </div>

      {/* Now Playing Card */}
      {currentSong && (
        <div className="card preset-filled-primary p-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <Avatar.Image
                  src={coverArtCache.get(currentSong.songId) || undefined}
                  alt={currentSong.metadata?.title || 'Unknown Title'}
                />
                <Avatar.Fallback className="text-2xl">♪</Avatar.Fallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1">
                {queue.isPlaying && (
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center animate-pulse">
                    <PlayIcon className="w-3 h-3 text-primary-600 ml-0.5" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="h3 font-bold truncate mb-1">
                {currentSong.metadata?.title || 'Unknown Title'}
              </h3>
              <p className="text-surface-600-400 truncate mb-2">
                {currentSong.metadata?.artist || 'Unknown Artist'}
              </p>
              <div className="flex items-center gap-3">
                <span className="badge preset-filled-primary-contrast text-xs">NOW PLAYING</span>
                <div className="flex items-center gap-1 text-xs text-surface-600-400">
                  {queue.isPlaying ? (
                    <>
                      <PauseIcon className="w-3 h-3" />
                      Playing
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-3 h-3" />
                      Paused
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden md:block text-right">
              <div className="text-sm text-surface-600-400 font-mono">
                {formatTime(audioPlayer.currentTime)} / {formatTime(audioPlayer.duration || 0)}
              </div>
              <Progress
                value={(audioPlayer.currentTime / (audioPlayer.duration || 1)) * 100}
                className="w-32 h-1 mt-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Songs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="h3">Upcoming</h2>
          {upcomingSongs.length > 0 && (
            <span className="badge preset-tonal-surface text-sm">
              {upcomingSongs.length} {upcomingSongs.length === 1 ? 'song' : 'songs'}
            </span>
          )}
        </div>

        {upcomingSongs.length === 0 ? (
          <div className="card preset-tonal-surface p-8 text-center">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-surface-200-800 flex items-center justify-center">
              <SkipForwardIcon className="w-12 h-12 text-surface-400-600" />
            </div>
            <p className="text-surface-600-400 mb-2">No upcoming songs</p>
            <p className="text-sm text-surface-500-500">
              Add songs from the Songs view to build your queue.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingSongs.map((queueItem) => {
              const index = queue.items.indexOf(queueItem);
              const queuePosition = index - queue.currentIndex;

              return (
                <div
                  key={`${queueItem.song.songId}-${queueItem.addedAt.getTime()}`}
                  className="card preset-tonal-surface hover:preset-tonal-primary transition-all cursor-move group"
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(index)}
                >
                  <div className="flex items-center gap-4 p-2">
                    {/* Queue Position */}
                    <div className="flex-shrink-0">
                      <span className="badge preset-tonal-surface w-10 h-10 rounded-full p-0 flex items-center justify-center font-bold">
                        {queuePosition}
                      </span>
                    </div>

                    {/* Album Art */}
                    <Avatar className="w-14 h-14 flex-shrink-0">
                      <Avatar.Image
                        src={coverArtCache.get(queueItem.song.songId) || undefined}
                        alt={queueItem.song.metadata?.title || 'Unknown Title'}
                      />
                      <Avatar.Fallback>♪</Avatar.Fallback>
                    </Avatar>

                    {/* Song Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold truncate mb-1 group-hover:text-primary-600 transition-colors">
                        {queueItem.song.metadata?.title || 'Unknown Title'}
                      </h4>
                      <p className="text-sm text-surface-600-400 truncate">
                        {queueItem.song.metadata?.artist || 'Unknown Artist'}
                      </p>
                    </div>

                    {/* Duration */}
                    <div className="hidden sm:block text-sm text-surface-600-400 font-mono">
                      {formatDuration(Number(queueItem.song.durationMs))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-5 h-5 text-surface-400-600 cursor-move">
                        <GripVerticalIcon className="w-full h-full" />
                      </div>
                      <button
                        onClick={() => queue.removeFromQueue(index)}
                        className="btn btn-icon btn-icon-sm preset-tonal hover:preset-tonal-error"
                      >
                        <Trash2Icon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Played Songs - Collapsible */}
      {playedSongs.length > 0 && (
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none p-4 card preset-tonal-surface hover:preset-tonal-primary transition-all">
            <div className="flex items-center gap-3">
              <h2 className="h3">Played</h2>
              <span className="badge preset-tonal-surface text-sm">
                {playedSongs.length}
              </span>
            </div>
            <div className="transform transition-transform group-open:rotate-180">
              <SkipForwardIcon className="w-5 h-5" />
            </div>
          </summary>

          <div className="mt-3 space-y-2 opacity-60">
            {playedSongs.map((queueItem) => (
              <div key={`${queueItem.song.songId}-${queueItem.addedAt.getTime()}`}
                   className="flex items-center gap-3 p-3 rounded-lg bg-surface-100-900">
                <PlayIcon className="w-4 h-4 text-success-500 rotate-180" />
                <span className="font-medium truncate">
                  {queueItem.song.metadata?.title || 'Unknown Title'}
                </span>
                <span className="text-sm text-surface-600-400">
                  {queueItem.song.metadata?.artist || 'Unknown Artist'}
                </span>
                <span className="text-sm text-surface-500-500 ml-auto">
                  {formatDuration(Number(queueItem.song.durationMs))}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
