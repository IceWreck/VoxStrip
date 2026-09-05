// Reference pitch track loading and lookup. The backend extracts one note
// list per song from the separated vocal stem; scoring and the pitch lane
// both read it through this module.

import { mediaUrl } from '../api/client';

export interface PitchNote {
  // Seconds from track start.
  start: number;
  duration: number;
  // Fractional MIDI note number (A4 = 69.0).
  midi: number;
}

export interface PitchTrack {
  version: number;
  notes: PitchNote[];
}

const SUPPORTED_VERSION = 1;

// fetchPitchTrack loads a song's reference track, or null when the song has
// none (not yet processed, extraction failed, or incompatible format).
export async function fetchPitchTrack(songId: string, signal?: AbortSignal): Promise<PitchTrack | null> {
  const response = await fetch(mediaUrl.pitch(songId), { credentials: 'include', signal });
  if (!response.ok) return null;

  const track = (await response.json()) as PitchTrack;
  if (track.version !== SUPPORTED_VERSION || !Array.isArray(track.notes)) return null;
  return track;
}

// noteAtTime returns the note sounding at the given time, or, within
// toleranceSeconds of the time, the nearest note edge. The tolerance absorbs
// mic latency and honest human timing spread.
export function noteAtTime(notes: PitchNote[], time: number, toleranceSeconds: number): PitchNote | null {
  if (notes.length === 0) return null;

  // Binary search for the last note starting at or before time + tolerance.
  let low = 0;
  let high = notes.length - 1;
  let candidate = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (notes[mid].start <= time + toleranceSeconds) {
      candidate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (candidate === -1) return null;

  const note = notes[candidate];
  if (time <= note.start + note.duration + toleranceSeconds) return note;

  // Between notes: the next note may be within tolerance ahead.
  const next = notes[candidate + 1];
  if (next && next.start - time <= toleranceSeconds) return next;
  return null;
}

// midiToNoteName formats a fractional MIDI value as a note name like "A4".
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  return `${NOTE_NAMES[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}
