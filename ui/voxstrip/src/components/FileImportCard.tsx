import { FileIcon, EditIcon, Trash2Icon, AlertCircleIcon } from 'lucide-react';

interface FileMetadataOverrides {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  lyrics?: string;
  coverArtFile?: File;
}

interface FileImportCardProps {
  file: File;
  overrides?: FileMetadataOverrides;
  onEdit: () => void;
  onRemove: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default function FileImportCard({
  file,
  overrides,
  onEdit,
  onRemove,
}: FileImportCardProps) {
  const hasOverrides =
    overrides &&
    (overrides.title ||
      overrides.artist ||
      overrides.album ||
      overrides.albumArtist ||
      overrides.genre ||
      overrides.lyrics ||
      overrides.coverArtFile);

  const overrideCount = overrides
    ? [
        overrides.title,
        overrides.artist,
        overrides.album,
        overrides.albumArtist,
        overrides.genre,
        overrides.lyrics,
        overrides.coverArtFile,
      ].filter(Boolean).length
    : 0;

  return (
    <div className="card preset-outlined-surface-200-800 p-4 space-y-3 hover:preset-outlined-surface-300-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 size-12 bg-surface-200-800 rounded-full flex items-center justify-center">
          <FileIcon className="size-5 text-surface-500-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{file.name}</p>
          <p className="text-xs text-surface-600-400">
            {formatFileSize(file.size)}
          </p>
        </div>
      </div>

      {hasOverrides && (
        <div className="flex items-center gap-2 text-xs text-surface-600-400">
          <AlertCircleIcon className="size-3" />
          <span>{overrideCount} custom override{overrideCount > 1 ? 's' : ''} set</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 btn preset-tonal text-sm flex items-center justify-center gap-2"
        >
          <EditIcon className="size-4" />
          Edit Metadata
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="btn preset-tonal-error flex-shrink-0"
          aria-label="Remove file"
        >
          <Trash2Icon className="size-4" />
        </button>
      </div>
    </div>
  );
}
