import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Song } from '../api/client.js';
import { VoxStripAPI, handleAPIError } from '../api/client.js';

export interface UseSongsLibraryOptions {
  autoLoad?: boolean;
}

export interface UseSongsLibraryReturn {
  songs: Song[];
  totalSize: number;
  loading: boolean;
  loadingProgress: number;
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredSongs: Song[];
  refresh: () => void;
  clearError: () => void;
}

export function useSongsLibrary(options: UseSongsLibraryOptions = {}): UseSongsLibraryReturn {
  const { autoLoad = true } = options;

  const BATCH_SIZE = 500;

  const [songs, setSongs] = useState<Song[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const hasLoaded = useRef(false);

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

  const loadAllSongs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadingProgress(0);
      setSongs([]);

      let allSongs: Song[] = [];
      let pageToken = '';
      let totalSize = 0;
      const seenSongIds = new Set<string>();

      while (true) {
        const response = await VoxStripAPI.listSongs({
          pageSize: BATCH_SIZE,
          pageToken,
        });

        const newSongs = response.songs.filter(song => !seenSongIds.has(song.songId));

        if (newSongs.length === 0) {
          break;
        }

        newSongs.forEach(song => seenSongIds.add(song.songId));
        allSongs = [...allSongs, ...newSongs];

        totalSize = Number(response.totalSize) || allSongs.length;

        if (totalSize > 0) {
          setLoadingProgress((allSongs.length / totalSize) * 100);
        }

        if (!response.nextPageToken) {
          break;
        }

        if (newSongs.length < BATCH_SIZE) {
          break;
        }

        pageToken = response.nextPageToken;
      }

      setSongs(allSongs);
      setTotalSize(totalSize);
      setLoadingProgress(100);
      hasLoaded.current = true;

    } catch (err) {
      const apiError = handleAPIError(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  }, [BATCH_SIZE]);

  const refresh = useCallback(() => {
    hasLoaded.current = false;
    loadAllSongs();
  }, [loadAllSongs]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoLoad && !hasLoaded.current && !loading && !error) {
      loadAllSongs();
    }
  }, [autoLoad, loadAllSongs, loading, error]);

  return {
    songs,
    totalSize,
    loading,
    loadingProgress,
    error,
    searchTerm,
    setSearchTerm,
    filteredSongs,
    refresh,
    clearError,
  };
}
