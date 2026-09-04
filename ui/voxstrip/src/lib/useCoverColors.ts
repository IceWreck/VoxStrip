import { useEffect, useState } from 'react';
import { API_BASE, mediaUrl } from '../api/client';
import { extractDominantColors, FALLBACK_COLORS } from './colors';

interface ColorResult {
  songId: string;
  colors: string[];
}

// Module-level cache so revisiting a song doesn't re-fetch and re-sample the
// cover (avoids the gradient flashing back to the fallback palette).
const colorCache = new Map<string, string[]>();

// useCoverColors loads a song's cover art off-screen and returns its three
// dominant colors for background gradients.
export function useCoverColors(songId: string | null): string[] {
  const [result, setResult] = useState<ColorResult | null>(null);

  useEffect(() => {
    if (!songId || colorCache.has(songId)) return;

    let cancelled = false;
    const img = new Image();
    // Cross-origin dev setups need CORS approval for canvas sampling.
    if (API_BASE) img.crossOrigin = 'anonymous';
    img.src = mediaUrl.cover(songId);
    img.onload = () => {
      if (cancelled) return;
      const colors = extractDominantColors(img);
      colorCache.set(songId, colors);
      setResult({ songId, colors });
    };
    img.onerror = () => {
      if (cancelled) return;
      colorCache.set(songId, FALLBACK_COLORS);
      setResult({ songId, colors: FALLBACK_COLORS });
    };
    return () => {
      cancelled = true;
    };
  }, [songId]);

  if (songId) {
    const cached = colorCache.get(songId);
    if (cached) return cached;
  }
  return result?.songId === songId ? result.colors : FALLBACK_COLORS;
}
