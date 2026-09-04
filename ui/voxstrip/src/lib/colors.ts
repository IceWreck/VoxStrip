// Dominant color extraction from cover art, used for the player/stage
// background gradients.

export const FALLBACK_COLORS = ['#1c1526', '#2b1f3d', '#3d2b52'];

// extractDominantColors samples an image and returns its three most frequent
// quantized colors. Falls back to the default palette when the canvas is
// unavailable or the image is cross-origin tainted.
export function extractDominantColors(img: HTMLImageElement): string[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return FALLBACK_COLORS;

  const size = 64;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return FALLBACK_COLORS;
  }

  const counts = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    // Quantize each channel to 32 levels to group similar colors.
    const r = data[i] & 0xe0;
    const g = data[i + 1] & 0xe0;
    const b = data[i + 2] & 0xe0;
    const key = (r << 16) | (g << 8) | b;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => `#${key.toString(16).padStart(6, '0')}`);

  while (top.length < 3) top.push(FALLBACK_COLORS[top.length]);
  return top;
}
