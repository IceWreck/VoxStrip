import { useState, useEffect, useMemo, useCallback } from 'react';
import { SearchIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import type { Song } from '../api/client.js';
import { VoxStripAPI, handleAPIError } from '../api/client.js';
import { useAppContext } from '../router/context.js';
import { UI_CONFIG } from '../config.js';
import StatusBadge from '../components/StatusBadge.js';

export default function SongsView() {
  const { queue } = useAppContext();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState<number>(UI_CONFIG.DEFAULT_PAGE_SIZE);
  const [pageToken, setPageToken] = useState<string>('');
  const [totalSize, setTotalSize] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load songs
  const loadSongs = useCallback(async (refresh = false) => {
    try {
      setLoading(!refresh);
      setError(null);
      
      const response = await VoxStripAPI.listSongs({
        pageSize,
        pageToken: refresh ? '' : pageToken,
      });

      if (refresh) {
        setSongs(response.songs);
        setPageToken('');
      } else {
        // Ensure no duplicates when loading more songs
        setSongs(prev => {
          const existingIds = new Set(prev.map(song => song.songId));
          const newSongs = response.songs.filter(song => !existingIds.has(song.songId));
          return [...prev, ...newSongs];
        });
      }
      
      setTotalSize(Number(response.totalSize) || response.songs.length);
      
    } catch (err) {
      const apiError = handleAPIError(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize, pageToken]);

  // Initial load
  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSongs(true);
  };

  // Filter songs based on search term
  const filteredSongs = useMemo(() => {
    if (!searchTerm.trim()) return songs;

    const searchLower = searchTerm.toLowerCase();
    return songs.filter(song => {
      const metadata = song.metadata;
      if (!metadata) return false;
      
      return (
        metadata.title?.toLowerCase().includes(searchLower) ||
        metadata.artist?.toLowerCase().includes(searchLower) ||
        metadata.album?.toLowerCase().includes(searchLower) ||
        metadata.genre?.toLowerCase().includes(searchLower)
      );
    });
  }, [songs, searchTerm]);

  // Add song to queue
  const handleAddToQueue = (song: Song) => {
    queue.addToQueue(song);
  };

  // Format duration
  const formatDuration = (durationMs?: number): string => {
    if (!durationMs) return '--:--';
    const seconds = Math.floor(Number(durationMs) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
            onClick={handleRefresh}
            disabled={isRefreshing || loading}
            className="btn preset-outline flex items-center gap-2"
          >
            <RefreshCwIcon size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-surface-400-600 size-4" />
          <input
            type="text"
            placeholder="Search songs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-surface-200-800 rounded-lg bg-surface-50-950 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <select
          value={pageSize}
          onChange={(e) => {
            const newPageSize = Number(e.target.value);
            setPageSize(newPageSize);
            setPageToken('');
            setSongs([]);
          }}
          className="px-3 py-2 border border-surface-200-800 rounded-lg bg-surface-50-950 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {UI_CONFIG.PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
      </div>

      {/* Error State */}
      {error && (
        <div className="card preset-tonal-error p-4">
          <p className="font-medium">Error loading songs</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && songs.length === 0 ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-surface-200-800 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-200-800 rounded w-3/4"></div>
                  <div className="h-3 bg-surface-200-800 rounded w-1/2"></div>
                </div>
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
                     <button
                       onClick={() => handleAddToQueue(song)}
                       disabled={song.processingStatus !== 3} // Only completed songs can be added
                       className="btn preset-outline flex items-center gap-1"
                     >
                      <PlusIcon size={14} />
                      Add
                    </button>
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
      {!loading && songs.length < totalSize && (
        <div className="text-center py-4">
          <button
            onClick={() => loadSongs()}
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
    </div>
  );
}