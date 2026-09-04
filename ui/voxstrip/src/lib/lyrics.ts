// LRC lyrics parsing and playback-position lookup, kept pure for easy reuse
// by the player view and the stage display.

export interface LyricLine {
  // Seconds from track start, or null for lines without a timestamp.
  time: number | null;
  text: string;
}

export interface Lyrics {
  lines: LyricLine[];
  // True when enough lines carry timestamps to drive synchronized display.
  synced: boolean;
  // Offset declared by the file's [offset:] tag, in milliseconds. Positive
  // values shift lyrics earlier, matching the LRC convention.
  offsetMs: number;
}

const TIMESTAMP_PATTERN = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const METADATA_PATTERN = /^\[(ar|ti|al|au|by|offset|re|ve|length):.*\]$/i;
const OFFSET_PATTERN = /^\[offset:\s*([+-]?\d+)\s*\]$/i;

// parseLyrics parses plain or LRC-formatted lyrics. Lines with multiple
// timestamps are expanded into one entry per timestamp; LRC metadata tags are
// dropped, except [offset:] which is applied. Synced lines are sorted by time.
export function parseLyrics(raw?: string): Lyrics {
  if (!raw?.trim()) return { lines: [], synced: false, offsetMs: 0 };

  const lines: LyricLine[] = [];
  let timestamped = 0;
  let offsetMs = 0;

  for (const rawLine of raw.split('\n')) {
    const line = rawLine.trim();
    const offsetMatch = line.match(OFFSET_PATTERN);
    if (offsetMatch) {
      offsetMs = Number(offsetMatch[1]);
      continue;
    }
    if (!line || METADATA_PATTERN.test(line)) continue;

    const stamps = [...line.matchAll(TIMESTAMP_PATTERN)];
    const text = line.replaceAll(TIMESTAMP_PATTERN, '').trim();
    if (!text) continue;

    if (stamps.length === 0) {
      lines.push({ time: null, text });
      continue;
    }

    for (const stamp of stamps) {
      const minutes = Number(stamp[1]);
      const seconds = Number(stamp[2]);
      const fraction = stamp[3] ? Number(stamp[3].padEnd(3, '0')) / 1000 : 0;
      lines.push({ time: minutes * 60 + seconds + fraction, text });
      timestamped++;
    }
  }

  // Treat lyrics as synced when the majority of lines carry timestamps;
  // occasional untimed lines (section headers etc.) shouldn't break sync mode.
  const synced = timestamped > 0 && timestamped >= lines.length / 2;
  if (synced) {
    lines.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  }
  return { lines, synced, offsetMs };
}

// activeLineIndex returns the index of the line being sung at the given
// playback position, or -1 before the first timestamped line. The user
// offset stacks on top of the file's own [offset:] tag.
export function activeLineIndex(lyrics: Lyrics, positionSeconds: number, userOffsetMs = 0): number {
  if (!lyrics.synced) return -1;

  const position = positionSeconds + (lyrics.offsetMs + userOffsetMs) / 1000;
  let active = -1;
  for (let i = 0; i < lyrics.lines.length; i++) {
    const time = lyrics.lines[i].time;
    if (time !== null && time <= position) {
      active = i;
    } else if (time !== null && time > position) {
      break;
    }
  }
  return active;
}
