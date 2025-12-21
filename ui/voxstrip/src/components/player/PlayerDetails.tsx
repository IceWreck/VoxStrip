import type { Song } from '../../api/client.js';
import StatusBadge from '../StatusBadge.js';

type PlayerDetailsProps = {
  song: Song;
  coverArtUrl: string;
  onImageError: () => void;
};

export default function PlayerDetails({ song, coverArtUrl, onImageError }: PlayerDetailsProps) {
  return (
    <div className="space-y-4">
      <div className="aspect-square rounded-lg overflow-hidden shadow-xl">
        <img
          src={coverArtUrl}
          alt={song.metadata?.title || 'Unknown Title'}
          className="w-full h-full object-cover"
          onError={onImageError}
        />
      </div>

      <div className="text-center space-y-2">
        <h2 className="h3 font-bold">
          {song.metadata?.title || 'Unknown Title'}
        </h2>
        <p className="text-lg text-surface-600-400">
          {song.metadata?.artist || 'Unknown Artist'}
        </p>
        <p className="text-surface-500-500">
          {song.metadata?.album || 'Unknown Album'}
        </p>
        <div className="flex justify-center">
          <StatusBadge status={song.processingStatus} showIcon={false} />
        </div>
      </div>
    </div>
  );
}
