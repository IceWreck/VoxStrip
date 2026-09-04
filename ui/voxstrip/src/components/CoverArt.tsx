import { useState } from 'react';
import { MusicIcon } from 'lucide-react';
import { mediaUrl } from '../api/client';

interface CoverArtProps {
  songId: string;
  alt: string;
  className?: string;
}

// CoverArt renders a song's cover from the cacheable media URL, falling back
// to a placeholder tile when the song has no cover art.
export default function CoverArt({ songId, alt, className = '' }: CoverArtProps) {
  // Track failure per song id so switching songs retries automatically.
  const [failedId, setFailedId] = useState<string | null>(null);

  if (failedId === songId) {
    return (
      <div className={`flex items-center justify-center bg-surface-300-700 text-surface-600-400 ${className}`}>
        <MusicIcon className="size-1/2" />
      </div>
    );
  }

  return (
    <img
      src={mediaUrl.cover(songId)}
      alt={alt}
      loading="lazy"
      className={`object-cover ${className}`}
      onError={() => setFailedId(songId)}
    />
  );
}
