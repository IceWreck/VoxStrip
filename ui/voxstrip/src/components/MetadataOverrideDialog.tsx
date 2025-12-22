import { Dialog, Portal } from '@skeletonlabs/skeleton-react';
import { XIcon, ImageIcon } from 'lucide-react';
import React from 'react';

interface FileMetadataOverrides {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  lyrics?: string;
  coverArtFile?: File;
}

interface MetadataOverrideDialogProps {
  isOpen: boolean;
  fileName: string;
  overrides: FileMetadataOverrides;
  onSave: (overrides: FileMetadataOverrides) => void;
  onCancel: () => void;
}

export default function MetadataOverrideDialog({
  isOpen,
  fileName,
  overrides,
  onSave,
  onCancel,
}: MetadataOverrideDialogProps) {
  const [localOverrides, setLocalOverrides] =
    React.useState<FileMetadataOverrides>(overrides);

  const handleFieldChange = (
    field: keyof FileMetadataOverrides,
    value: string
  ) => {
    setLocalOverrides((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const handleCoverArtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalOverrides((prev) => ({ ...prev, coverArtFile: file }));
    }
  };

  const handleSave = () => {
    onSave(localOverrides);
  };

  const handleRemoveCoverArt = () => {
    setLocalOverrides((prev) => ({ ...prev, coverArtFile: undefined }));
  };

  const hasCoverArt = localOverrides.coverArtFile !== undefined;

  return (
    <Dialog open={isOpen}>
      <Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-surface-50-950/50" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex justify-center items-center p-4">
          <Dialog.Content className="card bg-surface-100-900 w-full max-w-lg p-6 space-y-4 shadow-xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-start">
              <Dialog.Title className="h3">Edit Metadata</Dialog.Title>
              <Dialog.CloseTrigger
                onClick={onCancel}
                className="btn-icon hover:preset-tonal"
              >
                <XIcon className="size-5" />
              </Dialog.CloseTrigger>
            </div>

            <Dialog.Description className="text-sm text-surface-600-400">
              File: {fileName}
            </Dialog.Description>

            <div className="space-y-3">
              <div>
                <label className="label">
                  <span className="label-text">Title Override</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Leave empty to use file metadata"
                  value={localOverrides.title || ''}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Artist Override</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Leave empty to use file metadata"
                  value={localOverrides.artist || ''}
                  onChange={(e) => handleFieldChange('artist', e.target.value)}
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Album Override</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Leave empty to use file metadata"
                  value={localOverrides.album || ''}
                  onChange={(e) => handleFieldChange('album', e.target.value)}
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Album Artist Override</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Leave empty to use file metadata"
                  value={localOverrides.albumArtist || ''}
                  onChange={(e) => handleFieldChange('albumArtist', e.target.value)}
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Genre Override</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Leave empty to use file metadata"
                  value={localOverrides.genre || ''}
                  onChange={(e) => handleFieldChange('genre', e.target.value)}
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Lyrics Override</span>
                </label>
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder="Leave empty to use file metadata"
                  value={localOverrides.lyrics || ''}
                  onChange={(e) => handleFieldChange('lyrics', e.target.value)}
                />
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Cover Art Override</span>
                </label>
                {hasCoverArt ? (
                  <div className="flex items-center gap-3 p-3 bg-surface-200-800 rounded-container">
                    <ImageIcon className="size-8 text-surface-600-400 flex-shrink-0" />
                    <span className="flex-1 truncate text-sm">
                      {localOverrides.coverArtFile?.name}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveCoverArt}
                      className="btn preset-tonal-error text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <label className="btn preset-tonal w-full flex items-center justify-center gap-2">
                    <ImageIcon className="size-4" />
                    <span>Upload Cover Art</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverArtChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Dialog.CloseTrigger
                onClick={onCancel}
                className="btn preset-tonal"
              >
                Cancel
              </Dialog.CloseTrigger>
              <button type="button" onClick={handleSave} className="btn preset-filled">
                Save Overrides
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog>
  );
}
