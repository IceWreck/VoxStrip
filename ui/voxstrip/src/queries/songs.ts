// TanStack Query hooks for the song library. The library is loaded fully
// (client-side search/sort is instant at this collection size) and refetches
// automatically while any song is still processing.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ProcessingStatus, type Song } from '../api/client';

const PAGE_SIZE = 500;
const PROCESSING_POLL_MS = 3000;

export const songsQueryKey = ['songs'] as const;

async function fetchAllSongs(): Promise<Song[]> {
  const songs: Song[] = [];
  const seen = new Set<string>();
  let pageToken = '';

  for (;;) {
    const response = await api.listSongs({ pageSize: PAGE_SIZE, pageToken });
    for (const song of response.songs) {
      if (!seen.has(song.songId)) {
        seen.add(song.songId);
        songs.push(song);
      }
    }
    if (!response.nextPageToken || response.songs.length === 0) break;
    pageToken = response.nextPageToken;
  }
  return songs;
}

function hasActiveProcessing(songs?: Song[]): boolean {
  return (
    songs?.some(
      (song) =>
        song.processingStatus === ProcessingStatus.PENDING ||
        song.processingStatus === ProcessingStatus.PROCESSING,
    ) ?? false
  );
}

// useSongs loads the whole library and polls while imports are processing so
// status badges flip to Completed without manual refreshes.
export function useSongs() {
  return useQuery({
    queryKey: songsQueryKey,
    queryFn: fetchAllSongs,
    refetchInterval: (query) => (hasActiveProcessing(query.state.data) ? PROCESSING_POLL_MS : false),
  });
}

export function useDeleteSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (songId: string) => api.deleteSong({ songId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: songsQueryKey }),
  });
}

export interface SongMetadataUpdate {
  songId: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  lyrics?: string;
}

export function useUpdateSong() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: SongMetadataUpdate) => api.updateSong(update),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: songsQueryKey }),
  });
}
