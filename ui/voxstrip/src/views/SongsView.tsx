import type { Song } from '../api/client.js';
import { formatDuration } from '../utils/formatters.js';
import { SearchIcon, PlusIcon, RefreshCwIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useSongsLibrary } from '../hooks/useSongsLibrary.js';
import { useAppContext } from '../router/context.js';
import { UI_CONFIG } from '../config.js';
import StatusBadge from '../components/StatusBadge.js';
import { isProcessingComplete } from '../utils/statusHelpers.js';
import { toaster } from '../toaster.js';
import { VoxStripAPI } from '../api/client.js';
import { Dialog, Portal } from '@skeletonlabs/skeleton-react';
import { useState } from 'react';

export default function SongsView() {
  const { queue } = useAppContext();
  const {
    songs: allSongs,
    totalSize,
    loading,
    refreshing,
    error,
    searchTerm,
    setSearchTerm,
    filteredSongs,
    pageSize,
    setPageSize,
    loadMore,
    hasMore,
    refresh,
    clearError,
  } = useSongsLibrary();

  const [songToDelete, setSongToDelete] = useState<Song | null>(null);

  // Add song to queue
  const handleAddToQueue = (song: Song) => {
    queue.addToQueue(song);

    // Show success toast
    toaster.success({
      title: "Added to Queue",
      description: `"${song.metadata?.title}" by ${song.metadata?.artist || 'Unknown Artist'}`
    });
  };

  const handleDelete = async () => {
    if (!songToDelete) return;

    try {
      await VoxStripAPI.deleteSong(songToDelete.songId);
      toaster.success({
        title: "Song Deleted",
        description: `"${songToDelete.metadata?.title}" removed from library`
      });
      refresh();
    } catch (error) {
      toaster.error({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setSongToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="h2">Songs</h1>
          <p className="text-surface-600-400">
            {totalSize} {totalSize === 1 ? 'song' : 'songs'} in your library
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={refresh}
            disabled={refreshing || loading}
            className="btn preset-outline flex items-center gap-2"
          >
            <RefreshCwIcon size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <label className="flex-1 max-w-md">
          <span className="sr-only">Search songs</span>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400-600 size-4" />
            <input
              type="search"
              placeholder="Search songs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
        </label>
        <label>
          <span className="sr-only">Page size</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="select"
          >
            {UI_CONFIG.PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Error State */}
      {error && (
        <div className="card preset-tonal-error p-4">
          <p className="font-medium">Error loading songs</p>
          <p className="text-sm opacity-80">{error}</p>
          <button onClick={clearError} className="btn preset-outline mt-2">
            Clear Error
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && allSongs.length === 0 ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-4">
              <div className="placeholder w-12 h-12"></div>
              <div className="flex-1 space-y-2">
                <div className="placeholder h-4 w-3/4"></div>
                <div className="placeholder h-3 w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Songs Table */
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-surface-200-800">
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Artist</th>
                <th className="text-left p-3 font-medium">Album</th>
                <th className="text-left p-3 font-medium">Duration</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSongs.map((song) => (
                <tr 
                  key={song.songId} 
                  className="border-b border-surface-100-900 hover:bg-surface-100-900 transition-colors"
                >
                  <td className="p-3">
                    <div className="font-medium truncate max-w-xs">
                      {song.metadata?.title || 'Unknown Title'}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-surface-600-400 truncate max-w-xs">
                      {song.metadata?.artist || 'Unknown Artist'}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="text-surface-600-400 truncate max-w-xs">
                      {song.metadata?.album || 'Unknown Album'}
                    </div>
                  </td>
                   <td className="p-3">
                     <div className="text-surface-600-400">
                       {formatDuration(Number(song.durationMs))}
                     </div>
                   </td>
                   <td className="p-3">
                     <StatusBadge status={song.processingStatus} showIcon={false} />
                   </td>
                   <td className="p-3 text-right">
                       <div className="flex items-center justify-end gap-1">
                         <button
                           onClick={() => handleAddToQueue(song)}
                           disabled={!isProcessingComplete(song.processingStatus)}
                           className="btn preset-outline flex items-center gap-1"
                         >
                           <PlusIcon size={14} />
                           Add
                         </button>
                         <button
                           onClick={() => setSongToDelete(song)}
                           className="btn-icon preset-tonal"
                           title="Delete song"
                         >
                           <Trash2Icon size={14} />
                         </button>
                       </div>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredSongs.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="text-surface-400-600 mb-2">
                {searchTerm ? 'No songs found matching your search' : 'No songs in your library'}
              </div>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="btn preset-outline"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Load More */}
      {!loading && hasMore && (
        <div className="text-center py-4">
          <button
            onClick={loadMore}
            disabled={loading}
            className="btn preset-outline flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <RefreshCwIcon size={16} className="animate-spin" />
            ) : null}
            Load more songs
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={songToDelete !== null} onOpenChange={(details) => !details.open && setSongToDelete(null)}>
        <Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-surface-50-950/50" />
          <Dialog.Positioner className="fixed inset-0 z-50 flex justify-center items-center p-4">
            <Dialog.Content className="card bg-surface-100-900 w-full max-w-md p-4 space-y-4 shadow-xl">
              <header className="flex justify-between items-center">
                <Dialog.Title className="text-lg font-bold">Delete Song</Dialog.Title>
                <Dialog.CloseTrigger className="btn-icon hover:preset-tonal">
                  <XIcon className="size-4" />
                </Dialog.CloseTrigger>
              </header>
              <Dialog.Description>
                Are you sure you want to delete "{songToDelete?.metadata?.title || 'this song'}"? This action cannot be undone.
              </Dialog.Description>
              <footer className="flex justify-end gap-2">
                <Dialog.CloseTrigger className="btn preset-tonal">Cancel</Dialog.CloseTrigger>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="btn preset-filled-error"
                >
                  Delete
                </button>
              </footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog>
    </div>
  );
}