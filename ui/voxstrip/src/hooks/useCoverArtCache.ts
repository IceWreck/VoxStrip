import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VoxStripAPI } from '../api/client.js';

interface UseCoverArtCacheOptions {
  cleanupOnUnmount?: boolean;
}

interface CoverArtCache {
  get: (songId: string) => string | null;
  load: (songId: string) => Promise<string | null>;
  clear: () => void;
  revokeAll: () => void;
}

export const useCoverArtCache = (options: UseCoverArtCacheOptions = {}): CoverArtCache => {
  const [coverArtUrls, setCoverArtUrls] = useState<Map<string, string>>(new Map());
  const generatedUrlsRef = useRef<Set<string>>(new Set());
  const { cleanupOnUnmount = true } = options;

  const get = useCallback((songId: string): string | null => {
    return coverArtUrls.get(songId) || null;
  }, [coverArtUrls]);

  const load = useCallback(async (songId: string): Promise<string | null> => {
    try {
      const response = await VoxStripAPI.getCoverArt(songId);
      const blob = new Blob([new Uint8Array(response.image)], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      generatedUrlsRef.current.add(url);
      
      setCoverArtUrls(prev => new Map(prev).set(songId, url));
      return url;
    } catch (error) {
      console.error(`Failed to load cover art for ${songId}:`, error);
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    setCoverArtUrls(new Map());
  }, []);

  const revokeAll = useCallback(() => {
    generatedUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    generatedUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!cleanupOnUnmount) return;
    return () => {
      revokeAll();
    };
  }, [revokeAll, cleanupOnUnmount]);

  return useMemo(() => ({
    get,
    load,
    clear,
    revokeAll,
  }), [get, load, clear, revokeAll]);
};

export const useBatchCoverArtLoader = (songIds: string[], cache: CoverArtCache) => {
  useEffect(() => {
    const missingIds = songIds.filter(id => !cache.get(id));
    if (missingIds.length === 0) return;

    const loadCoverArts = async () => {
      await Promise.allSettled(missingIds.map(id => cache.load(id)));
    };

    loadCoverArts();
  }, [songIds, cache]);
};
