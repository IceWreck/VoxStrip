// ScoreSummary is the end-of-song results card: total score, rank, and the
// per-line rating breakdown. In the player it auto-dismisses after a few
// seconds unless closed sooner; on the stage it is display-only and follows
// the main window's lifetime via broadcasts.

import { useEffect } from 'react';
import { XIcon } from 'lucide-react';
import type { LineRating, ScoreSummary as Summary } from '../lib/scoring';

const AUTO_CLOSE_MS = 5000;

const RATING_LABELS: Array<{ rating: LineRating; label: string; className: string }> = [
  { rating: 'perfect', label: 'Perfect', className: 'text-emerald-400' },
  { rating: 'great', label: 'Great', className: 'text-teal-300' },
  { rating: 'good', label: 'Good', className: 'text-amber-300' },
  { rating: 'ok', label: 'OK', className: 'text-orange-300' },
  { rating: 'miss', label: 'Miss', className: 'text-rose-400' },
];

interface ScoreSummaryProps {
  summary: Summary;
  // Closes the card; also fired automatically after AUTO_CLOSE_MS.
  onClose?: () => void;
  // Stage rendering scales up for across-the-room readability and has no
  // controls of its own.
  stage?: boolean;
}

export default function ScoreSummary({ summary, onClose, stage = false }: ScoreSummaryProps) {
  useEffect(() => {
    if (!onClose) return;
    const timer = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [onClose, summary]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div
        className={`card preset-tonal-surface relative w-full space-y-6 text-center shadow-2xl ${
          stage ? 'max-w-2xl p-12' : 'max-w-md p-8'
        }`}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn-icon btn-icon-sm absolute top-3 right-3 hover:preset-tonal"
            aria-label="Close score summary"
          >
            <XIcon className="size-4" />
          </button>
        )}

        <div>
          <p className={`tracking-widest text-surface-600-400 uppercase ${stage ? 'text-2xl' : 'text-sm'}`}>
            {summary.rank}
          </p>
          <p className={`font-black tabular-nums ${stage ? 'text-9xl' : 'text-6xl'}`}>{summary.score}</p>
          <p className={`mt-1 text-surface-600-400 ${stage ? 'text-xl' : 'text-sm'}`}>
            {Math.round(summary.accuracy * 100)}% pitch accuracy · best streak {summary.bestCombo}
          </p>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {RATING_LABELS.map(({ rating, label, className }) => (
            <div key={rating} className={`rounded-base bg-surface-200-800/60 ${stage ? 'py-4' : 'py-2'}`}>
              <p className={`font-bold tabular-nums ${stage ? 'text-4xl' : 'text-xl'} ${className}`}>
                {summary.ratingCounts[rating]}
              </p>
              <p className={`text-surface-600-400 ${stage ? 'text-base' : 'text-xs'}`}>{label}</p>
            </div>
          ))}
        </div>

        {summary.skippedLines > 0 && (
          <p className={`text-surface-600-400 ${stage ? 'text-base' : 'text-xs'}`}>
            {summary.skippedLines} lines not attempted
          </p>
        )}
      </div>
    </div>
  );
}
