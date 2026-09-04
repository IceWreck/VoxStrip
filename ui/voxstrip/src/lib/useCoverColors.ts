import { useEffect, useState } from 'react';
import { API_BASE, mediaUrl } from '../api/client';
import { extractDominantColors, FALLBACK_COLORS } from './colors';

interface ColorResult {
  songId: string;
  colors: string[];
}

// useCoverColors loads a song's cover art off-screen and returns its three
// dominant colors for background gradients.
export function useCoverColors(songId: string | null): string[] {
  const [result, setResult] = useState<ColorResult | null>(null);

  useEffect(() => {
    if (!songId) return;

    let cancelled = false;
    const img = new Image();
    // Cross-origin dev setups need CORS approval for canvas sampling.
    if (API_BASE) img.crossOrigin = 'anonymous';
    img.src = mediaUrl.cover(songId);
    img.onload = () => {
      if (!cancelled) setResult({ songId, colors: extractDominantColors(img) });
    };
    img.onerror = () => {
      if (!cancelled) setResult({ songId, colors: FALLBACK_COLORS });
    };
    return () => {
      cancelled = true;
    };
  }, [songId]);

  return result?.songId === songId ? result.colors : FALLBACK_COLORS;
}
