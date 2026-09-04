import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileUpload, Progress } from '@skeletonlabs/skeleton-react';
import {
  AlertTriangleIcon,
  CheckIcon,
  FileMusicIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
  UploadCloudIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { api, ProcessingStatus, errorMessage } from '../api/client';
import { songsQueryKey, useSongs } from '../queries/songs';
import { formatFileSize } from '../lib/format';
import { toaster } from '../toaster';
import MetadataDialog, { type SongMetadataFields } from '../components/MetadataDialog';

type StagedStatus = 'staged' | 'uploading' | 'done' | 'failed';

interface StagedFile {
  id: string;
  file: File;
  overrides: SongMetadataFields;
  coverArtFile?: File;
  status: StagedStatus;
  error?: string;
}

// normalizeTitle reduces a title or filename to a comparable form for
// duplicate detection.
function normalizeTitle(value: string): string {
  return value
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ImportView stages audio files, lets each get metadata overrides, warns
// about likely duplicates, and imports files one request at a time so each
// failure is isolated and progress is visible.
export default function ImportView() {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const { data: songs } = useSongs();
  const queryClient = useQueryClient();
  const importAbort = useRef(false);

  const libraryTitles = useMemo(() => {
    const titles = new Set<string>();
    for (const song of songs ?? []) {
      const title = song.metadata?.title;
      if (title) titles.add(normalizeTitle(title));
    }
    return titles;
  }, [songs]);

  const isDuplicate = (item: StagedFile): boolean => {
    const candidate = item.overrides.title ?? item.file.name;
    return libraryTitles.has(normalizeTitle(candidate));
  };

  const addFiles = (files: File[]) => {
    setStaged((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        overrides: {},
        status: 'staged' as const,
      })),
    ]);
  };

  const updateStaged = (id: string, patch: Partial<StagedFile>) => {
    setStaged((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const importAll = async () => {
    const pending = staged.filter((item) => item.status === 'staged' || item.status === 'failed');
    if (pending.length === 0 || importing) return;

    setImporting(true);
    importAbort.current = false;
    let succeeded = 0;
    let failed = 0;

    for (const item of pending) {
      if (importAbort.current) break;
      updateStaged(item.id, { status: 'uploading', error: undefined });
      try {
        const audio = new Uint8Array(await item.file.arrayBuffer());
        const coverArtOverride = item.coverArtFile
          ? new Uint8Array(await item.coverArtFile.arrayBuffer())
          : undefined;

        const response = await api.importSongs({
          songs: [
            {
              audio,
              coverArtOverride,
              titleOverride: item.overrides.title,
              artistOverride: item.overrides.artist,
              albumOverride: item.overrides.album,
              albumArtistOverride: item.overrides.albumArtist,
              genreOverride: item.overrides.genre,
              lyricsOverride: item.overrides.lyrics,
            },
          ],
        });

        const result = response.results[0];
        if (result && result.status !== ProcessingStatus.FAILED) {
          succeeded++;
          updateStaged(item.id, { status: 'done' });
        } else {
          failed++;
          updateStaged(item.id, { status: 'failed', error: result?.errorMessage || 'import failed' });
        }
      } catch (err) {
        failed++;
        updateStaged(item.id, { status: 'failed', error: errorMessage(err) });
      }
      // Keep the library (and duplicate detection) fresh as songs land.
      queryClient.invalidateQueries({ queryKey: songsQueryKey });
    }

    setImporting(false);
    // Successful uploads leave the staging area; failures stay for retry.
    setStaged((prev) => prev.filter((item) => item.status !== 'done'));

    if (failed === 0 && succeeded > 0) {
      toaster.success({ title: 'Import complete', description: `${succeeded} song${succeeded === 1 ? '' : 's'} queued for processing` });
    } else if (succeeded > 0) {
      toaster.warning({ title: 'Import partially complete', description: `${succeeded} succeeded, ${failed} failed` });
    } else if (failed > 0) {
      toaster.error({ title: 'Import failed', description: `${failed} song${failed === 1 ? '' : 's'} failed to import` });
    }
  };

  const editing = staged.find((item) => item.id === editingId);
  const pendingCount = staged.filter((item) => item.status === 'staged' || item.status === 'failed').length;
  const doneCount = staged.filter((item) => item.status === 'done').length;
  const progress = importing ? (doneCount / Math.max(staged.length, 1)) * 100 : null;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="h2">Import</h1>
        <p className="text-surface-600-400">
          Upload audio files; vocals and instrumentals are separated automatically after import.
        </p>
      </div>

      <FileUpload accept="audio/*,.ogg" maxFiles={100} onFileAccept={(details) => addFiles(details.files)}>
        <FileUpload.Dropzone className="card preset-outlined-surface-200-800 flex flex-col items-center gap-3 p-10 text-center transition-colors hover:preset-tonal">
          <UploadIcon className="size-10 text-surface-500" />
          <p className="font-medium">Drag &amp; drop audio files here</p>
          <p className="text-sm text-surface-600-400">MP3, FLAC, WAV, AAC, OGG — metadata is read from tags</p>
          <FileUpload.Trigger className="btn preset-filled-primary-500">Browse Files</FileUpload.Trigger>
          <FileUpload.HiddenInput />
        </FileUpload.Dropzone>
      </FileUpload>

      {staged.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="h4">
              {staged.length} file{staged.length === 1 ? '' : 's'} staged
            </h2>
            <button
              type="button"
              onClick={() => setStaged([])}
              disabled={importing}
              className="btn btn-sm preset-tonal"
            >
              <Trash2Icon className="size-4" />
              Clear All
            </button>
          </div>

          <ul className="space-y-2">
            {staged.map((item) => {
              const overrideCount = [
                ...Object.values(item.overrides).filter(Boolean),
                item.coverArtFile,
              ].filter(Boolean).length;
              return (
                <li key={item.id} className="card preset-tonal-surface flex items-center gap-3 p-3">
                  <FileMusicIcon className="size-8 shrink-0 text-surface-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.overrides.title || item.file.name}</p>
                    <p className="text-xs text-surface-600-400">
                      {formatFileSize(item.file.size)}
                      {overrideCount > 0 && ` · ${overrideCount} override${overrideCount === 1 ? '' : 's'}`}
                    </p>
                    {item.error && <p className="truncate text-xs text-error-500">{item.error}</p>}
                  </div>

                  {isDuplicate(item) && (
                    <span className="badge preset-tonal-warning shrink-0" title="A song with this title is already in your library">
                      <AlertTriangleIcon size={12} />
                      Duplicate?
                    </span>
                  )}

                  {item.status === 'uploading' && <Loader2Icon className="size-4 shrink-0 animate-spin text-primary-500" />}
                  {item.status === 'done' && <CheckIcon className="size-4 shrink-0 text-success-500" />}
                  {item.status === 'failed' && <XIcon className="size-4 shrink-0 text-error-500" />}

                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    disabled={importing}
                    className="btn-icon btn-icon-sm hover:preset-tonal"
                    title="Edit metadata overrides"
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaged((prev) => prev.filter((f) => f.id !== item.id))}
                    disabled={importing}
                    className="btn-icon btn-icon-sm hover:preset-tonal-error"
                    title="Remove file"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>

          {progress !== null && (
            <Progress value={progress}>
              <Progress.Track>
                <Progress.Range />
              </Progress.Track>
            </Progress>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={importAll}
              disabled={importing || pendingCount === 0}
              className="btn preset-filled-primary-500 px-8"
            >
              {importing ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <UploadCloudIcon className="size-4" />
                  Import {pendingCount} {pendingCount === 1 ? 'file' : 'files'}
                </>
              )}
            </button>
          </div>
        </>
      )}

      {editing && (
        <MetadataDialog
          open
          heading="Metadata Overrides"
          subheading={`${editing.file.name} — empty fields use the file's own tags`}
          initial={editing.overrides}
          coverArt={{ initialFile: editing.coverArtFile }}
          saveLabel="Save Overrides"
          onSave={(fields, coverArtFile) => {
            updateStaged(editing.id, { overrides: fields, coverArtFile });
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
