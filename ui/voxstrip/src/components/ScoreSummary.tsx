// ScoreSummary is the end-of-song results overlay: total score, rank, and
// the per-line rating breakdown.

import { XIcon } from 'lucide-react';
import type { LineRating, ScoreSummary as Summary } from '../lib/scoring';

const RATING_LABELS: Array<{ rating: LineRating; label: string; className: string }> = [
  { rating: 'perfect', label: 'Perfect', className: 'text-emerald-400' },
  { rating: 'great', label: 'Great', className: 'text-teal-300' },
  { rating: 'good', label: 'Good', className: 'text-amber-300' },
  { rating: 'ok', label: 'OK', className: 'text-orange-300' },
  { rating: 'miss', label: 'Miss', className: 'text-rose-400' },
];

export default function ScoreSummary({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="card preset-tonal-surface relative w-full max-w-md space-y-6 p-8 text-center shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="btn-icon btn-icon-sm absolute top-3 right-3 hover:preset-tonal"
          aria-label="Close score summary"
        >
          <XIcon className="size-4" />
        </button>

        <div>
          <p className="text-sm tracking-widest text-surface-600-400 uppercase">{summary.rank}</p>
          <p className="text-6xl font-black tabular-nums">{summary.score}</p>
          <p className="mt-1 text-sm text-surface-600-400">
            {Math.round(summary.accuracy * 100)}% pitch accuracy · best streak {summary.bestCombo}
          </p>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {RATING_LABELS.map(({ rating, label, className }) => (
            <div key={rating} className="rounded-base bg-surface-200-800/60 py-2">
              <p className={`text-xl font-bold tabular-nums ${className}`}>{summary.ratingCounts[rating]}</p>
              <p className="text-xs text-surface-600-400">{label}</p>
            </div>
          ))}
        </div>

        {summary.skippedLines > 0 && (
          <p className="text-xs text-surface-600-400">{summary.skippedLines} lines not attempted</p>
        )}

        <button type="button" onClick={onClose} className="btn preset-filled-primary-500 w-full">
          Done
        </button>
      </div>
    </div>
  );
}
