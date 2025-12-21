import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Song } from '../api/client.js';
import { VoxStripAPI, handleAPIError } from '../api/client.js';
import { UI_CONFIG } from '../config.js';

export interface UseSongsLibraryOptions {
  initialPageSize?: number;
  autoLoad?: boolean;
}

export interface UseSongsLibraryReturn {
  // Data
  songs: Song[];
  totalSize: number;
  
  // Loading states
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  
  // Search and filter
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredSongs: Song[];
  
  // Pagination
  pageSize: number;
  setPageSize: (size: number) => void;
  pageToken: string;
  loadMore: () => void;
  hasMore: boolean;
  
  // Actions
  refresh: () => void;
  clearError: () => void;
  reset: () => void;
}

export function useSongsLibrary(options: UseSongsLibraryOptions = {}): UseSongsLibraryReturn {
  const { initialPageSize = UI_CONFIG.DEFAULT_PAGE_SIZE, autoLoad = true } = options;
  
  // Data state
  const [songs, setSongs] = useState<Song[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [pageToken, setPageToken] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Load songs
  const loadSongs = useCallback(async (refresh = false, cursor?: string) => {
    try {
      setLoading(!refresh);
      setError(null);
      
      const response = await VoxStripAPI.listSongs({
        pageSize,
        pageToken: refresh ? '' : cursor ?? pageToken,
      });

      if (refresh) {
        setSongs(response.songs);
      } else {
        // Ensure no duplicates when loading more songs
        setSongs(prev => {
          const existingIds = new Set(prev.map(song => song.songId));
          const newSongs = response.songs.filter(song => !existingIds.has(song.songId));
          return [...prev, ...newSongs];
        });
      }
      
      setPageToken(response.nextPageToken || '');
      setTotalSize(Number(response.totalSize) || response.songs.length);
      
    } catch (err) {
      const apiError = handleAPIError(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pageSize, pageToken]);

  // Refresh songs
  const refresh = useCallback(() => {
    setRefreshing(true);
    loadSongs(true, '');
  }, [loadSongs]);

  // Load more songs
  const loadMore = useCallback(() => {
    if (loading) return;
    loadSongs(false);
  }, [loading, loadSongs]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset all state
  const reset = useCallback(() => {
    setSongs([]);
    setTotalSize(0);
    setPageToken('');
    setSearchTerm('');
    setError(null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Auto-load on mount if enabled
  useEffect(() => {
    if (autoLoad && songs.length === 0 && !loading) {
      loadSongs(false);
    }
  }, [autoLoad, loadSongs, songs.length, loading]);

  // Check if there are more songs to load
  const hasMore = songs.length < totalSize;

  return {
    // Data
    songs,
    totalSize,
    filteredSongs,
    
    // Loading states
    loading,
    refreshing,
    error,
    
    // Search and filter
    searchTerm,
    setSearchTerm,
    
    // Pagination
    pageSize,
    setPageSize,
    pageToken,
    loadMore,
    hasMore,
    
    // Actions
    refresh,
    clearError,
    reset,
  };
}