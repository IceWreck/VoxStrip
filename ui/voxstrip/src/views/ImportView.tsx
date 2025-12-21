import { UploadIcon, MusicIcon, ClockIcon } from 'lucide-react';

export default function ImportView() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="h2">Import</h1>
        <p className="text-surface-600-400">
          Add new music to your library (Coming Soon)
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="card preset-tonal-surface p-8 text-center">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface-200-800 flex items-center justify-center">
          <UploadIcon size={32} className="text-surface-400-600" />
        </div>
        
        <h3 className="h3 mb-4">Import Music Coming Soon</h3>
        
        <div className="max-w-md mx-auto space-y-4 text-left">
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
            <ClockIcon size={20} className="text-surface-400-600" />
            <div>
              <h4 className="font-medium">Automatic Processing</h4>
              <p className="text-sm text-surface-600-400">
                AI-powered vocal separation happens automatically
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button className="btn preset-outline" disabled>
            <UploadIcon size={16} className="mr-2" />
            Upload Files (Coming Soon)
          </button>
        </div>
        
        <p className="text-sm text-surface-500-500 mt-4">
          This feature is currently under development. Check back soon!
        </p>
      </div>

      {/* Current Status */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card preset-tonal-surface p-6 text-center">
          <h4 className="font-medium mb-2">0 Songs</h4>
          <p className="text-sm text-surface-600-400">Waiting to import</p>
        </div>
        
        <div className="card preset-tonal-surface p-6 text-center">
          <h4 className="font-medium mb-2">0 Processing</h4>
          <p className="text-sm text-surface-600-400">AI is ready</p>
        </div>
        
        <div className="card preset-tonal-surface p-6 text-center">
          <h4 className="font-medium mb-2">All Formats</h4>
          <p className="text-sm text-surface-600-400">Supported</p>
        </div>
      </div>
    </div>
  );
}