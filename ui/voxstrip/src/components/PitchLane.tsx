// PitchLane renders the SingStar-style pitch view: reference note bars
// scrolling right to left with the singer's live pitch trace over them. It
// draws straight from mutable lane data every frame, so nothing here
// re-renders React during singing. The player view feeds it from the scoring
// provider; the stage window feeds it from broadcast messages.

import { useEffect, useRef, type RefObject } from 'react';
import { foldSemitones, type SampleState } from '../lib/scoring';
import type { PitchNote } from '../lib/pitchTrack';

export interface TraceSample {
  time: number;
  midi: number | null;
  state: SampleState;
}

// LaneData is the mutable shared state a lane owner keeps updated and the
// canvas reads every animation frame.
export interface LaneData {
  notes: PitchNote[];
  trace: TraceSample[];
  songTime: () => number;
}

// Visible time window around the playhead, in seconds.
const PAST_SECONDS = 2;
const FUTURE_SECONDS = 6;

// Minimum semitone span of the vertical axis; widens when the visible
// reference notes need more room.
const MIN_SPAN_SEMITONES = 16;

const TRACE_COLORS: Record<string, string> = {
  hit: '#34d399',
  near: '#fbbf24',
  off: '#fb7185',
  rest: 'rgba(255,255,255,0.35)',
  silent: 'rgba(255,255,255,0.2)',
};

export default function PitchLane({ laneRef, active }: { laneRef: RefObject<LaneData>; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let frame: number;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const lane = laneRef.current;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      const now = lane.songTime();
      const windowStart = now - PAST_SECONDS;
      const windowEnd = now + FUTURE_SECONDS;
      const xFor = (time: number) => ((time - windowStart) / (windowEnd - windowStart)) * width;

      const visible = lane.notes.filter(
        (note) => note.start + note.duration >= windowStart && note.start <= windowEnd,
      );

      // Center the axis on the median visible reference pitch and keep it
      // stable-ish frame to frame by rounding.
      let center = 60;
      if (visible.length > 0) {
        const midis = visible.map((n) => n.midi).sort((a, b) => a - b);
        center = Math.round(midis[midis.length >> 1]);
      }
      let span = MIN_SPAN_SEMITONES;
      for (const note of visible) {
        span = Math.max(span, 2 * Math.abs(note.midi - center) + 4);
      }
      const yFor = (midi: number) => height / 2 - ((midi - center) / span) * height;

      // Playhead.
      const nowX = xFor(now);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(nowX, 0, 1.5, height);

      // Reference note bars; already-passed portions dim.
      const barHeight = Math.max(4, height / span);
      for (const note of visible) {
        const x0 = Math.max(0, xFor(note.start));
        const x1 = Math.min(width, xFor(note.start + note.duration));
        const y = yFor(note.midi) - barHeight / 2;
        context.fillStyle = x1 < nowX ? 'rgba(148,163,184,0.35)' : 'rgba(226,232,240,0.75)';
        context.beginPath();
        context.roundRect(x0, y, Math.max(2, x1 - x0), barHeight, barHeight / 2);
        context.fill();
      }

      // Singer's trace, folded to the octave nearest the reference so an
      // octave-down singer still lands on the bars they are matching.
      for (const sample of lane.trace) {
        if (sample.midi === null || sample.time < windowStart) continue;
        const nearest = nearestNoteMidi(visible, sample.time);
        const display = nearest === null ? sample.midi : nearest + foldSemitones(sample.midi, nearest);
        context.fillStyle = TRACE_COLORS[sample.state] ?? TRACE_COLORS.rest;
        context.beginPath();
        context.arc(xFor(sample.time), yFor(display), 2.5, 0, Math.PI * 2);
        context.fill();
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, laneRef]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="h-24 w-full" />;
}

function nearestNoteMidi(notes: Array<{ start: number; duration: number; midi: number }>, time: number): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const note of notes) {
    const distance = time < note.start ? note.start - time : time > note.start + note.duration ? time - note.start - note.duration : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = note.midi;
    }
  }
  return best;
}
