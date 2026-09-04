// Typed localStorage helpers. All persistence goes through here so keys stay
// in one place and JSON parse failures never propagate.

const PREFIX = 'voxstrip:';

export function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable; persistence is best-effort.
  }
}
