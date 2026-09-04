import { useState, type DragEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { GripVerticalIcon, ListMusicIcon, PauseIcon, PlayIcon, Trash2Icon } from 'lucide-react';
import { usePlayback, usePlayer } from '../player/store';
import { formatDuration } from '../lib/format';
import CoverArt from '../components/CoverArt';
import ConfirmDialog from '../components/ConfirmDialog';

// QueueView manages the ordered playback queue: click to play, drag to
// reorder, remove entries, or clear everything.
export default function QueueView() {
  const player = usePlayer();
  const { isPlaying } = usePlayback();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const totalMs = player.queue.reduce((sum, item) => sum + Number(item.song.durationMs), 0);

  const handleDrop = (dropIndex: number) => (event: DragEvent) => {
    event.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      player.moveItem(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="h2">Queue</h1>
          <p className="text-surface-600-400">
            {player.queue.length} {player.queue.length === 1 ? 'song' : 'songs'} · {formatDuration(totalMs)} total
          </p>
        </div>
        {player.queue.length > 0 && (
          <button type="button" onClick={() => setConfirmClear(true)} className="btn preset-outlined-surface-200-800">
            <Trash2Icon className="size-4" />
            Clear Queue
          </button>
        )}
      </div>

      {player.queue.length === 0 ? (
        <div className="card preset-tonal-surface flex flex-col items-center gap-4 p-12 text-center">
          <ListMusicIcon className="size-16 text-surface-500" />
          <p className="text-surface-600-400">The queue is empty.</p>
          <Link to="/songs" className="btn preset-filled-primary-500">
            Browse Songs
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {player.queue.map((item, index) => {
            const isCurrent = index === player.currentIndex;
            const isPast = index < player.currentIndex;
            return (
              <li
                key={item.queueId}
                draggable
                onDragStart={() => setDraggedIndex(index)}
                onDragEnd={() => setDraggedIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop(index)}
                className={`card group flex cursor-grab items-center gap-3 p-2 transition-colors ${
                  isCurrent
                    ? 'preset-filled-primary-100-900 border border-primary-500'
                    : 'preset-tonal-surface hover:preset-tonal-primary'
                } ${isPast ? 'opacity-50' : ''}`}
              >
                <GripVerticalIcon className="size-4 shrink-0 text-surface-500" />
                <span className="w-6 shrink-0 text-center font-mono text-sm text-surface-600-400">{index + 1}</span>

                <button
                  type="button"
                  onClick={() => (isCurrent ? player.togglePlay() : player.playAt(index))}
                  className="relative shrink-0"
                  aria-label={isCurrent && isPlaying ? 'Pause' : 'Play this song'}
                >
                  <CoverArt
                    key={item.song.songId}
                    songId={item.song.songId}
                    alt=""
                    className="size-12 rounded-base"
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-base bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    {isCurrent && isPlaying ? (
                      <PauseIcon className="size-5 text-white" />
                    ) : (
                      <PlayIcon className="size-5 text-white" />
                    )}
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.song.metadata?.title || 'Unknown Title'}</p>
                  <p className="truncate text-sm text-surface-600-400">
                    {item.song.metadata?.artist || 'Unknown Artist'}
                  </p>
                </div>

                {isCurrent && (
                  <span className="badge preset-filled-primary-500 shrink-0">
                    {isPlaying ? 'Playing' : 'Paused'}
                  </span>
                )}

                <span className="hidden shrink-0 font-mono text-sm text-surface-600-400 sm:block">
                  {formatDuration(item.song.durationMs)}
                </span>

                <button
                  type="button"
                  onClick={() => player.removeAt(index)}
                  className="btn-icon btn-icon-sm shrink-0 opacity-0 transition-opacity hover:preset-tonal-error group-hover:opacity-100"
                  aria-label="Remove from queue"
                >
                  <Trash2Icon className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear Queue"
        message="Remove all songs from the queue? Playback will stop."
        confirmLabel="Clear"
        onConfirm={() => {
          player.clearQueue();
          setConfirmClear(false);
        }}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
