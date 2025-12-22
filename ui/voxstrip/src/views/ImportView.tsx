import { useState } from 'react';
import { ProcessingStatus } from '../proto/server_pb.js';
import { UploadIcon, MusicIcon, Trash2Icon, UploadCloudIcon } from 'lucide-react';
import { FileUpload, Progress } from '@skeletonlabs/skeleton-react';
import { VoxStripAPI } from '../api/client.js';
import { toaster } from '../toaster.js';
import FileImportCard from '../components/FileImportCard.js';
import MetadataOverrideDialog from '../components/MetadataOverrideDialog.js';

interface FileMetadataOverrides {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  lyrics?: string;
  coverArtFile?: File;
}

interface PendingFile {
  id: string;
  file: File;
  overrides?: FileMetadataOverrides;
}

export default function ImportView() {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [editingFile, setEditingFile] = useState<PendingFile | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileAccept = (details: { files: File[] }) => {
    const newPendingFiles: PendingFile[] = details.files.map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
      overrides: undefined,
    }));
    setPendingFiles((prev) => [...prev, ...newPendingFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleEditFile = (id: string) => {
    const file = pendingFiles.find((f) => f.id === id);
    if (file) {
      setEditingFile(file);
    }
  };

  const handleSaveOverrides = (overrides: FileMetadataOverrides) => {
    if (!editingFile) return;
    setPendingFiles((prev) =>
      prev.map((f) =>
        f.id === editingFile.id ? { ...f, overrides } : f
      )
    );
    setEditingFile(null);
  };

  const handleCancelOverrides = () => {
    setEditingFile(null);
  };

  const handleClearAll = () => {
    setPendingFiles([]);
  };

  const handleImportAll = async () => {
    if (pendingFiles.length === 0 || isImporting) return;

    setIsImporting(true);
    try {
      const response = await VoxStripAPI.importSongs(pendingFiles);

      const successCount = response.results.filter(
        (r) => r.status === ProcessingStatus.PENDING
      ).length;
      const errorCount = response.results.filter(
        (r) => r.status === ProcessingStatus.FAILED
      ).length;

      if (errorCount === 0) {
        toaster.success({
          title: 'Import Complete',
          description: `${successCount} song${successCount > 1 ? 's' : ''} added to library`
        });
        setPendingFiles([]);
      } else if (successCount > 0) {
        toaster.warning({
          title: 'Import Partially Complete',
          description: `${successCount} succeeded, ${errorCount} failed`
        });
      } else {
        toaster.error({
          title: 'Import Failed',
          description: `${errorCount} song${errorCount > 1 ? 's' : ''} failed to import`
        });
      }
    } catch (error) {
      toaster.error({
        title: 'Import Error',
        description: error instanceof Error ? error.message : 'Failed to import songs'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const hasFiles = pendingFiles.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="h2">Import</h1>
        <p className="text-surface-600-400">
          Upload audio files to add them to your library
        </p>
      </div>

      {/* File Upload Area */}
      {!hasFiles && (
        <div className="card preset-tonal-surface p-8 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface-200-800 flex items-center justify-center">
            <UploadIcon size={32} className="text-surface-400-600" />
          </div>

          <h3 className="h3 mb-4">Upload Music Files</h3>

          <div className="max-w-md mx-auto space-y-4 text-left mb-6">
            <div className="flex items-center gap-3">
              <UploadIcon size={20} className="text-surface-400-600" />
              <div>
                <h4 className="font-medium">Drag & Drop Upload</h4>
                <p className="text-sm text-surface-600-400">
                  Simply drag your audio files onto this area
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MusicIcon size={20} className="text-surface-400-600" />
              <div>
                <h4 className="font-medium">Multiple Formats</h4>
                <p className="text-sm text-surface-600-400">
                  Support for MP3, WAV, FLAC, AAC, and more
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <UploadCloudIcon size={20} className="text-surface-400-600" />
              <div>
                <h4 className="font-medium">Custom Metadata</h4>
                <p className="text-sm text-surface-600-400">
                  Optionally override title, artist, album, lyrics, and cover art
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-md mx-auto">
            <FileUpload
              accept="audio/*,.ogg"
              maxFiles={100}
              onFileAccept={handleFileAccept}
              className="w-full"
            >
              <FileUpload.Dropzone className="card preset-outlined-surface-200-800 p-8 hover:preset-outlined-surface-300-700 transition-colors">
                <FileUpload.Trigger className="btn preset-filled">
                  <UploadIcon size={16} className="mr-2" />
                  Browse Files
                </FileUpload.Trigger>
                <FileUpload.HiddenInput />
              </FileUpload.Dropzone>
            </FileUpload>
          </div>
        </div>
      )}

      {/* Pending Files Section */}
      {hasFiles && (
        <>
          {/* Add More Files Button */}
          <div>
            <FileUpload
              accept="audio/*,.ogg"
              maxFiles={100}
              onFileAccept={handleFileAccept}
              className="w-full"
            >
              <FileUpload.Dropzone className="card preset-dashed-surface-200-800 p-6 text-center hover:preset-tonal transition-colors cursor-pointer">
                <UploadIcon size={24} className="mx-auto mb-2 text-surface-500-500" />
                <p className="text-sm font-medium">
                  Click to add more files or drag & drop here
                </p>
                <FileUpload.HiddenInput />
              </FileUpload.Dropzone>
            </FileUpload>
          </div>

          {/* Files Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="h3">
                {pendingFiles.length} File{pendingFiles.length > 1 ? 's' : ''} Ready
              </h2>
              <button
                type="button"
                onClick={handleClearAll}
                className="btn preset-tonal text-sm flex items-center gap-2"
                disabled={isImporting}
              >
                <Trash2Icon size={16} />
                Clear All
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingFiles.map((pendingFile) => (
                <FileImportCard
                  key={pendingFile.id}
                  file={pendingFile.file}
                  overrides={pendingFile.overrides}
                  onEdit={() => handleEditFile(pendingFile.id)}
                  onRemove={() => handleRemoveFile(pendingFile.id)}
                />
              ))}
            </div>
          </div>

          {/* Import Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200-800">
            <button
              type="button"
              onClick={handleImportAll}
              disabled={isImporting || pendingFiles.length === 0}
              className="btn preset-filled px-8 flex items-center gap-2"
            >
              {isImporting ? (
                <>
                  <Progress value={null} className="[--size:--spacing(4)]">
                    <Progress.Circle>
                      <Progress.CircleTrack />
                      <Progress.CircleRange />
                    </Progress.Circle>
                  </Progress>
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <UploadCloudIcon size={18} />
                  <span>Import All ({pendingFiles.length})</span>
                </>
              )}
            </button>
          </div>
        </>
      )}

      {/* Metadata Override Dialog */}
      {editingFile && (
        <MetadataOverrideDialog
          isOpen={true}
          fileName={editingFile.file.name}
          overrides={editingFile.overrides || {}}
          onSave={handleSaveOverrides}
          onCancel={handleCancelOverrides}
        />
      )}
    </div>
  );
}
