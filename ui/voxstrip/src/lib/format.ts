// Shared formatting helpers.

// formatDuration renders a millisecond duration as m:ss, or a placeholder when unknown.
export function formatDuration(durationMs?: number | bigint): string {
  const ms = Number(durationMs ?? 0);
  if (!ms) return '--:--';
  return formatTime(ms / 1000);
}

// formatTime renders seconds as m:ss.
export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// formatFileSize renders a byte count using binary units.
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log2(bytes) / 10), units.length - 1);
  const value = bytes / 2 ** (exponent * 10);
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}
