import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { Trash2Icon, GripVerticalIcon } from 'lucide-react';
import { useAppContext } from '../router/context.js';
import { VoxStripAPI } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.js';

const formatDuration = (durationMs?: number): string => {
  if (!durationMs) return '--:--';
  const seconds = Math.floor(Number(durationMs) / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function QueueView() {
  const { queue, audioPlayer } = useAppContext();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [coverArtUrls, setCoverArtUrls] = useState<Map<string, string>>(new Map());
  const generatedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const missingItems = queue.items.filter(item => !coverArtUrls.has(item.song.songId));
    if (missingItems.length === 0) {
      return;
    }

    const loadCoverArts = async () => {
      const updates: Array<[string, string]> = [];
      for (const item of missingItems) {
        try {
          const response = await VoxStripAPI.getCoverArt(item.song.songId);
          const blob = new Blob([response.image], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          generatedUrlsRef.current.add(url);
          updates.push([item.song.songId, url]);
        } catch (error) {
          console.error(`Failed to load cover art for ${item.song.songId}:`, error);
        }
      }

      if (cancelled || updates.length === 0) {
        return;
      }

      setCoverArtUrls(prev => {
        const next = new Map(prev);
        for (const [id, url] of updates) {
          next.set(id, url);
        }
        return next;
      });
    };

    loadCoverArts();

    return () => {
      cancelled = true;
    };
  }, [queue.items, coverArtUrls]);

  useEffect(() => () => {
    generatedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, dropIndex: number) => {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    queue.moveInQueue(draggedIndex, dropIndex);
    setDraggedIndex(null);
  };

  const handleClearQueue = () => {
    queue.clearQueue();
  };

  const currentSong = queue.currentSong;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="h2">Queue</h1>
          <p className="text-surface-600-400">
            {queue.items.length} {queue.items.length === 1 ? 'song' : 'songs'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/player" className="btn preset-outline">
            Open Player
          </Link>
          {queue.items.length > 0 && (
            <button onClick={handleClearQueue} className="btn preset-outline flex items-center gap-2">
              <Trash2Icon size={16} />
              Clear Queue
            </button>
          )}
        </div>
      </div>

      {currentSong && (
        <div className="card preset-tonal-primary p-6">
          <div className="flex items-center gap-4">
            <img
              src={coverArtUrls.get(currentSong.songId) || '/placeholder-album.png'}
              alt={currentSong.metadata?.title || 'Unknown Title'}
              className="w-16 h-16 rounded-lg object-cover"
              onError={(event) => {
                (event.target as HTMLImageElement).src = '/placeholder-album.png';
              }}
            />
            <div className="flex-1 min-w-0">
              <h3 className="h4 font-bold truncate">
                {currentSong.metadata?.title || 'Unknown Title'}
              </h3>
              <p className="text-surface-600-400 truncate">
                {currentSong.metadata?.artist || 'Unknown Artist'}
              </p>
              <p className="text-sm text-surface-500-500">
                Played on the Player view
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={currentSong.processingStatus} showIcon={false} />
              <div className="text-xs text-surface-600-400">
                {audioPlayer.isPlaying ? 'Playing now' : 'Paused'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="h3">Upcoming</h2>
        {queue.items.length === 0 ? (
          <div className="card preset-tonal-surface p-8 text-center">
            <p className="text-surface-400-600 mb-2">Your queue is empty</p>
            <p className="text-sm text-surface-500-500">
              Add songs from the Songs view to build a playlist.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.items.map((queueItem, index) => {
              const isCurrent = index === queue.currentIndex;
              const isPlayed = index < queue.currentIndex;
              const canDrag = index > queue.currentIndex;

              return (
                <div
                  key={`${queueItem.song.songId}-${queueItem.addedAt.getTime()}`}
                  className={`card p-4 transition-all ${
                    isCurrent
                      ? 'preset-tonal-primary ring-2 ring-primary-500'
                      : isPlayed
                      ? 'opacity-60'
                      : 'hover:preset-tonal-surface'
                  }`}
                  draggable={canDrag}
                  onDragStart={() => canDrag && handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={(event) => canDrag && handleDrop(event, index)}
                >
                  <div className="flex items-center gap-3">
                    {!isPlayed && canDrag && (
                      <GripVerticalIcon size={16} className="text-surface-400-600" />
                    )}

                    {isCurrent && (
                      <div className="flex items-center gap-1 text-primary-600 text-sm">
                        <span className="w-1 h-4 bg-primary-500 animate-pulse"></span>
                        Now Playing
                      </div>
                    )}

                    <img
                      src={coverArtUrls.get(queueItem.song.songId) || '/placeholder-album.png'}
                      alt={queueItem.song.metadata?.title || 'Unknown Title'}
                      className="w-10 h-10 rounded object-cover"
                      onError={(event) => {
                        (event.target as HTMLImageElement).src = '/placeholder-album.png';
                      }}
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium truncate ${isCurrent ? 'text-primary-600' : ''}`}>
                        {queueItem.song.metadata?.title || 'Unknown Title'}
                      </h4>
                      <p className="text-sm text-surface-600-400 truncate">
                        {queueItem.song.metadata?.artist || 'Unknown Artist'}
                      </p>
                    </div>

                    <div className="text-sm text-surface-600-400">
                      {formatDuration(Number(queueItem.song.durationMs))}
                    </div>

                    <button
                      onClick={() => queue.removeFromQueue(index)}
                      disabled={isCurrent}
                      className="btn preset-ghost"
                    >
                      <Trash2Icon size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
