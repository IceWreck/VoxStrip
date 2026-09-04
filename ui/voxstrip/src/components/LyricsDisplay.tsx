import type { Lyrics } from '../lib/lyrics';

interface LyricsDisplayProps {
  lyrics: Lyrics;
  activeIndex: number;
  // Enables click-to-seek on timestamped lines.
  onLineClick?: (timeSeconds: number) => void;
  // Stage rendering scales everything up for across-the-room readability.
  stage?: boolean;
}

// LyricsDisplay renders synced lyrics as a window around the active line, or
// plain lyrics as a scrollable block. Shared by the player and stage views.
export default function LyricsDisplay({ lyrics, activeIndex, onLineClick, stage = false }: LyricsDisplayProps) {
  if (lyrics.lines.length === 0) {
    return (
      <p className={`text-center text-surface-600-400 ${stage ? 'text-3xl' : 'text-lg'}`}>
        No lyrics for this song
      </p>
    );
  }

  if (!lyrics.synced) {
    return (
      <div className={`scrollbar-hide max-h-full space-y-3 overflow-y-auto text-center ${stage ? 'text-4xl leading-relaxed' : 'text-xl'}`}>
        {lyrics.lines.map((line, i) => (
          <p key={i} className="text-white/90">
            {line.text}
          </p>
        ))}
      </div>
    );
  }

  const before = lyrics.lines.slice(Math.max(0, activeIndex - 2), Math.max(0, activeIndex));
  const current = activeIndex >= 0 ? lyrics.lines[activeIndex] : null;
  const after = lyrics.lines.slice(activeIndex + 1, activeIndex + 4);

  const lineButton = (text: string, time: number | null, className: string, key: string) =>
    onLineClick && time !== null ? (
      <button type="button" key={key} onClick={() => onLineClick(time)} className={`${className} cursor-pointer transition-opacity hover:opacity-100`}>
        {text}
      </button>
    ) : (
      <p key={key} className={className}>
        {text}
      </p>
    );

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className={`space-y-2 opacity-40 ${stage ? 'min-h-28' : 'min-h-20'}`}>
        {before.map((line, i) =>
          lineButton(line.text, line.time, stage ? 'block text-4xl font-light text-white' : 'block text-2xl font-light text-white', `b${i}`),
        )}
      </div>

      <div className={`flex items-center justify-center ${stage ? 'min-h-40' : 'min-h-28'}`}>
        {current && (
          <p
            className={`font-bold text-white drop-shadow-2xl transition-all duration-300 ${
              stage ? 'text-6xl lg:text-8xl' : 'text-4xl md:text-6xl'
            }`}
          >
            {current.text}
          </p>
        )}
      </div>

      <div className={`space-y-2 opacity-70 ${stage ? 'min-h-40' : 'min-h-28'}`}>
        {after.map((line, i) =>
          lineButton(line.text, line.time, stage ? 'block text-4xl font-medium text-white' : 'block text-2xl font-medium text-white', `a${i}`),
        )}
      </div>
    </div>
  );
}
