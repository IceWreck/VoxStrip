import { useState } from 'react';
import { Dialog, Portal } from '@skeletonlabs/skeleton-react';
import { ImageIcon, XIcon } from 'lucide-react';

export interface SongMetadataFields {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  lyrics?: string;
}

interface MetadataDialogProps {
  open: boolean;
  heading: string;
  subheading?: string;
  initial: SongMetadataFields;
  // When set, the dialog also offers a cover art image picker (import only —
  // the API supports cover overrides at import time).
  coverArt?: { initialFile?: File };
  saveLabel?: string;
  busy?: boolean;
  onSave: (fields: SongMetadataFields, coverArtFile?: File) => void;
  onClose: () => void;
}

const TEXT_FIELDS: Array<{ key: keyof SongMetadataFields; label: string }> = [
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
  { key: 'album', label: 'Album' },
  { key: 'albumArtist', label: 'Album Artist' },
  { key: 'genre', label: 'Genre' },
];

// MetadataDialog edits song metadata fields, shared by the library editor and
// the import override flow. Lyrics accept plain text or LRC timestamps.
export default function MetadataDialog({
  open,
  heading,
  subheading,
  initial,
  coverArt,
  saveLabel = 'Save',
  busy = false,
  onSave,
  onClose,
}: MetadataDialogProps) {
  const [fields, setFields] = useState<SongMetadataFields>(initial);
  const [coverFile, setCoverFile] = useState<File | undefined>(coverArt?.initialFile);

  const setField = (key: keyof SongMetadataFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value || undefined }));
  };

  return (
    <Dialog open={open} onOpenChange={(details) => !details.open && onClose()}>
      <Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-surface-50-950/60 backdrop-blur-sm" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="card bg-surface-100-900 max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6 shadow-xl">
            <header className="flex items-start justify-between">
              <div>
                <Dialog.Title className="h4">{heading}</Dialog.Title>
                {subheading && (
                  <Dialog.Description className="text-sm text-surface-600-400">{subheading}</Dialog.Description>
                )}
              </div>
              <Dialog.CloseTrigger className="btn-icon hover:preset-tonal">
                <XIcon className="size-4" />
              </Dialog.CloseTrigger>
            </header>

            <div className="space-y-3">
              {TEXT_FIELDS.map(({ key, label }) => (
                <label key={key} className="label">
                  <span className="label-text">{label}</span>
                  <input
                    type="text"
                    className="input"
                    value={fields[key] ?? ''}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </label>
              ))}

              <label className="label">
                <span className="label-text">Lyrics (plain text or LRC with [mm:ss.xx] timestamps)</span>
                <textarea
                  className="textarea font-mono text-sm"
                  rows={8}
                  value={fields.lyrics ?? ''}
                  onChange={(e) => setField('lyrics', e.target.value)}
                />
              </label>

              {coverArt && (
                <div className="label">
                  <span className="label-text">Cover Art</span>
                  {coverFile ? (
                    <div className="flex items-center gap-3 rounded-base bg-surface-200-800 p-3">
                      <ImageIcon className="size-6 shrink-0 text-surface-600-400" />
                      <span className="flex-1 truncate text-sm">{coverFile.name}</span>
                      <button type="button" onClick={() => setCoverFile(undefined)} className="btn btn-sm preset-tonal-error">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="btn preset-tonal w-full cursor-pointer">
                      <ImageIcon className="size-4" />
                      Choose Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setCoverFile(e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>

            <footer className="flex justify-end gap-2 pt-2">
              <Dialog.CloseTrigger className="btn preset-tonal">Cancel</Dialog.CloseTrigger>
              <button
                type="button"
                onClick={() => onSave(fields, coverFile)}
                disabled={busy}
                className="btn preset-filled-primary-500"
              >
                {busy ? 'Saving…' : saveLabel}
              </button>
            </footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog>
  );
}
