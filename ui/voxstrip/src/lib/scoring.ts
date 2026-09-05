// Pure singing-score engine. A ScoringSession consumes timestamped mic pitch
// samples, compares them octave-invariantly against the reference pitch
// track, and accumulates per-lyric-line accuracy into a 0..10000 score.
// No audio, DOM, or timing dependencies, so it is trivially testable.

import type { Lyrics } from './lyrics';
import { noteAtTime, type PitchNote } from './pitchTrack';

// Comparison tolerances, tuned forgiving: this is a party game, not a
// conservatory exam. Within three quarters of a semitone is a full hit;
// within two semitones still earns most of the credit. The timing window
// forgives mic latency and honest human timing spread.
const PERFECT_SEMITONES = 0.75;
const GOOD_SEMITONES = 2.0;
const NEAR_CREDIT = 0.6;
const TIMING_WINDOW_SECONDS = 0.3;

// Unpitched instants during a reference note (breaths, consonants, note
// attacks) count as this fraction of a sample, so pausing for air dents the
// line accuracy instead of cratering it.
const SILENCE_SAMPLE_WEIGHT = 0.4;

export type SampleState = 'rest' | 'hit' | 'near' | 'off' | 'silent';

// SampleFeedback describes one scored instant, for live UI (pitch arrow,
// trace coloring).
export interface SampleFeedback {
  state: SampleState;
  targetMidi: number | null;
  sungMidi: number | null;
  // Signed octave-folded offset in semitones (positive = sharp).
  semitonesOff: number | null;
  // Credit earned in [0, 1]; null when the instant was not scoreable.
  credit: number | null;
}

export type LineRating = 'perfect' | 'great' | 'good' | 'ok' | 'miss';

const RATING_THRESHOLDS: Array<[number, LineRating]> = [
  [0.85, 'perfect'],
  [0.65, 'great'],
  [0.42, 'good'],
  [0.18, 'ok'],
];

export interface LineScore {
  lineIndex: number;
  startTime: number;
  // Seconds of reference notes inside this line; its weight in the total.
  referenceDuration: number;
  scoredSamples: number;
  earnedCredit: number;
}

export interface ScoreSnapshot {
  // 0..10000, final when the song ends.
  score: number;
  // Weighted accuracy in [0, 1] over lines sung so far.
  accuracy: number;
  // Consecutive finished lines rated great or better.
  combo: number;
  bestCombo: number;
  currentLineIndex: number;
  currentLineAccuracy: number | null;
  finishedLines: FinishedLine[];
}

export interface FinishedLine {
  lineIndex: number;
  rating: LineRating;
  accuracy: number;
}

export interface ScoreSummary {
  score: number;
  accuracy: number;
  bestCombo: number;
  ratingCounts: Record<LineRating, number>;
  // Lines with reference vocals the singer never attempted.
  skippedLines: number;
  rank: string;
}

interface Segment {
  lineIndex: number;
  start: number;
  end: number;
  referenceDuration: number;
}

// lineAccuracyRating maps a line's accuracy to its rating.
export function lineAccuracyRating(accuracy: number): LineRating {
  for (const [threshold, rating] of RATING_THRESHOLDS) {
    if (accuracy >= threshold) return rating;
  }
  return 'miss';
}

// foldSemitones returns the signed pitch offset folded into [-6, 6], making
// the comparison octave-invariant: singers routinely transpose an octave.
export function foldSemitones(sungMidi: number, targetMidi: number): number {
  let diff = (sungMidi - targetMidi) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

function creditFor(semitonesOff: number): number {
  const distance = Math.abs(semitonesOff);
  if (distance <= PERFECT_SEMITONES) return 1;
  if (distance <= GOOD_SEMITONES) return NEAR_CREDIT;
  return 0;
}

// buildSegments partitions the song timeline by synced lyric line starts and
// computes how much reference singing falls inside each partition. Without
// synced lyrics the whole song is a single segment.
function buildSegments(lyrics: Lyrics, notes: PitchNote[]): Segment[] {
  const starts: Array<{ lineIndex: number; start: number }> = [];
  if (lyrics.synced) {
    lyrics.lines.forEach((line, index) => {
      if (line.time !== null) starts.push({ lineIndex: index, start: line.time });
    });
  }
  if (starts.length === 0) starts.push({ lineIndex: 0, start: 0 });
  if (starts[0].start > 0) starts.unshift({ lineIndex: -1, start: 0 });

  return starts.map((entry, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].start : Infinity;
    let referenceDuration = 0;
    for (const note of notes) {
      const overlap = Math.min(note.start + note.duration, end) - Math.max(note.start, entry.start);
      if (overlap > 0) referenceDuration += overlap;
    }
    return { lineIndex: entry.lineIndex, start: entry.start, end, referenceDuration };
  });
}

export class ScoringSession {
  private readonly notes: PitchNote[];
  private readonly segments: Segment[];
  private readonly totalReferenceDuration: number;
  private readonly lines = new Map<number, LineScore>();
  private readonly finished: FinishedLine[] = [];
  private activeSegment = -1;
  private combo = 0;
  private bestCombo = 0;

  constructor(notes: PitchNote[], lyrics: Lyrics) {
    this.notes = notes;
    this.segments = buildSegments(lyrics, notes);
    this.totalReferenceDuration = this.segments.reduce((sum, s) => sum + s.referenceDuration, 0);
  }

  // addSample scores one mic reading at a song position. sungMidi is null
  // when the singer is silent or the mic reading was unpitched.
  addSample(songTime: number, sungMidi: number | null): SampleFeedback {
    this.advanceSegment(songTime);

    const target = noteAtTime(this.notes, songTime, TIMING_WINDOW_SECONDS);
    if (!target) {
      return { state: 'rest', targetMidi: null, sungMidi, semitonesOff: null, credit: null };
    }

    const line = this.activeLineScore();

    if (sungMidi === null) {
      line.scoredSamples += SILENCE_SAMPLE_WEIGHT;
      return { state: 'silent', targetMidi: target.midi, sungMidi: null, semitonesOff: null, credit: 0 };
    }

    line.scoredSamples++;
    const semitonesOff = foldSemitones(sungMidi, target.midi);
    const credit = creditFor(semitonesOff);
    line.earnedCredit += credit;

    const state: SampleState = credit === 1 ? 'hit' : credit > 0 ? 'near' : 'off';
    return { state, targetMidi: target.midi, sungMidi, semitonesOff, credit };
  }

  // finishLine closes out any in-progress line, e.g. at song end.
  finishPendingLine(): void {
    if (this.activeSegment !== -1) {
      this.finalizeSegment(this.segments[this.activeSegment]);
      this.activeSegment = -1;
    }
  }

  snapshot(): ScoreSnapshot {
    const active = this.activeSegment !== -1 ? this.segments[this.activeSegment] : null;
    const activeLine = active ? this.lines.get(active.lineIndex) : undefined;
    return {
      score: this.currentScore(),
      accuracy: this.overallAccuracy(),
      combo: this.combo,
      bestCombo: this.bestCombo,
      currentLineIndex: active?.lineIndex ?? -1,
      currentLineAccuracy:
        activeLine && activeLine.scoredSamples > 0 ? activeLine.earnedCredit / activeLine.scoredSamples : null,
      finishedLines: [...this.finished],
    };
  }

  summary(): ScoreSummary {
    this.finishPendingLine();
    const ratingCounts: Record<LineRating, number> = { perfect: 0, great: 0, good: 0, ok: 0, miss: 0 };
    for (const line of this.finished) {
      ratingCounts[line.rating]++;
    }
    const attempted = new Set(this.finished.map((line) => line.lineIndex));
    const skippedLines = this.segments.filter(
      (s) => s.referenceDuration > 0.5 && !attempted.has(s.lineIndex),
    ).length;

    const score = this.currentScore();
    return {
      score,
      accuracy: this.overallAccuracy(),
      bestCombo: this.bestCombo,
      ratingCounts,
      skippedLines,
      rank: rankFor(score),
    };
  }

  // advanceSegment tracks which lyric line the song position is in and
  // finalizes lines as playback leaves them.
  private advanceSegment(songTime: number): void {
    const index = this.segments.findIndex((s) => songTime >= s.start && songTime < s.end);
    if (index === this.activeSegment) return;
    this.finishPendingLine();
    this.activeSegment = index;
  }

  private finalizeSegment(segment: Segment): void {
    const line = this.lines.get(segment.lineIndex);
    if (!line || line.scoredSamples === 0) return;

    const accuracy = line.earnedCredit / line.scoredSamples;
    const rating = lineAccuracyRating(accuracy);
    // Re-singing a line (seek back) replaces its previous rating.
    const existing = this.finished.findIndex((f) => f.lineIndex === segment.lineIndex);
    if (existing !== -1) this.finished.splice(existing, 1);
    this.finished.push({ lineIndex: segment.lineIndex, rating, accuracy });

    if (rating === 'perfect' || rating === 'great') {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else {
      this.combo = 0;
    }
  }

  private activeLineScore(): LineScore {
    const segment = this.activeSegment !== -1 ? this.segments[this.activeSegment] : this.segments[0];
    let line = this.lines.get(segment.lineIndex);
    if (!line) {
      line = {
        lineIndex: segment.lineIndex,
        startTime: segment.start,
        referenceDuration: segment.referenceDuration,
        scoredSamples: 0,
        earnedCredit: 0,
      };
      this.lines.set(segment.lineIndex, line);
    }
    return line;
  }

  // currentScore weights each sung line's accuracy by its share of the
  // song's reference singing time, so long lines are worth more and skipped
  // lines earn nothing.
  private currentScore(): number {
    if (this.totalReferenceDuration === 0) return 0;
    let weighted = 0;
    for (const line of this.lines.values()) {
      if (line.scoredSamples === 0) continue;
      const accuracy = line.earnedCredit / line.scoredSamples;
      weighted += (line.referenceDuration / this.totalReferenceDuration) * accuracy;
    }
    return Math.round(weighted * 10000);
  }

  // overallAccuracy is the singer's average over what they actually sang,
  // ignoring skipped lines (unlike the score, which they forfeit).
  private overallAccuracy(): number {
    let credit = 0;
    let samples = 0;
    for (const line of this.lines.values()) {
      credit += line.earnedCredit;
      samples += line.scoredSamples;
    }
    return samples > 0 ? credit / samples : 0;
  }
}

function rankFor(score: number): string {
  if (score >= 9000) return 'Legend';
  if (score >= 7500) return 'Superstar';
  if (score >= 6000) return 'Lead Singer';
  if (score >= 4000) return 'Rising Star';
  if (score >= 2000) return 'Shower Singer';
  return 'Warming Up';
}
