import { useState, useEffect, useRef } from 'react';
import { 
  PlayIcon, 
  PauseIcon, 
  SkipForwardIcon, 
  SkipBackIcon, 
  Volume2Icon,
  VolumeXIcon,
  RepeatIcon,
  ShuffleIcon,
  DownloadIcon
} from 'lucide-react';
import { useAppContext } from '../router/context.js';
import { VoxStripAPI } from '../api/client.js';
import { AUDIO_VERSIONS, type AudioVersionKey } from '../config.js';
import StatusBadge from '../components/StatusBadge.js';
import { Link } from '@tanstack/react-router';

export default function PlayerView() {
  const { queue, audioPlayer } = useAppContext();
  const [selectedVersion, setSelectedVersion] = useState<AudioVersionKey>('KARAOKE');
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [coverArtUrl, setCoverArtUrl] = useState<string>('/placeholder-album.png');
  const lastLoadedVersion = useRef<AudioVersionKey | null>(null);

  // Sync audio version with player
  useEffect(() => {
    if (queue.currentSong && selectedVersion !== lastLoadedVersion.current) {
      // Load song with current version selection
      audioPlayer.loadSong(queue.currentSong, selectedVersion);
      lastLoadedVersion.current = selectedVersion;
    }
  }, [selectedVersion, queue.currentSong]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load cover art when current song changes
  useEffect(() => {
    let mounted = true;
    
    const loadCoverArt = async () => {
      if (queue.currentSong) {
        try {
          const response = await VoxStripAPI.getCoverArt(queue.currentSong.songId);
          if (mounted) {
            const blob = new Blob([response.image], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            setCoverArtUrl(url);
          }
        } catch (error) {
          console.error('Failed to load cover art:', error);
          if (mounted) {
            setCoverArtUrl('/placeholder-album.png');
          }
        }
      } else {
        if (mounted) {
          setCoverArtUrl('/placeholder-album.png');
        }
      }
    };

    loadCoverArt();

    // Cleanup function
    return () => {
      mounted = false;
      if (coverArtUrl !== '/placeholder-album.png') {
        URL.revokeObjectURL(coverArtUrl);
      }
    };
  }, [queue.currentSong]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle next song with repeat
  const handleNext = () => {
    if (queue.items.length === 0) return;
    
    if (queue.currentIndex === queue.items.length - 1 && repeat) {
      queue.jumpToIndex(0);
    } else {
      queue.playNext();
    }
  };

  const handlePlayPause = () => {
    if (!audioPlayer.currentSong) {
      // If no song loaded, play first in queue
      if (queue.items.length > 0) {
        queue.jumpToIndex(0);
      }
    } else {
      audioPlayer.togglePlayPause();
    }
  };

  const handlePrevious = () => {
    queue.playPrevious();
  };

  const handleVolumeToggle = () => {
    if (audioPlayer.volume > 0) {
      audioPlayer.setVolume(0);
    } else {
      audioPlayer.setVolume(1);
    }
  };

  const handleVersionChange = (version: AudioVersionKey) => {
    setSelectedVersion(version);
  };

  const handleDownload = async () => {
    if (queue.currentSong) {
      try {
        const response = await VoxStripAPI.downloadAudio({
          songId: queue.currentSong.songId,
          version: selectedVersion.toLowerCase() as 'original' | 'vocal' | 'instrumental' | 'karaoke',
          format: 'mp3',
          bitrate: 320
        });

        // Create blob and download
        const audioBlob = new Blob([response.audio], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(audioBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.filename || `${queue.currentSong.metadata?.title || 'unknown'}-${selectedVersion}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Parse lyrics for synchronized display (basic implementation)
  const parseLyrics = (lyrics?: string): Array<{ time: number; text: string }> => {
    if (!lyrics) return [];
    
    // Basic LRC format parsing
    const lines = lyrics.split('\n');
    const parsedLines: Array<{ time: number; text: string }> = [];
    
    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const milliseconds = parseInt(match[3].padEnd(3, '0').slice(0, 3));
        const time = (minutes * 60 + seconds) + milliseconds / 1000;
        const text = match[4].trim();
        if (text) {
          parsedLines.push({ time, text });
        }
      } else if (line.trim()) {
        // Non-timed lyrics line
        parsedLines.push({ time: -1, text: line.trim() });
      }
    }
    
    return parsedLines;
  };

  const currentSongLyrics = queue.currentSong?.metadata?.lyrics;
  const parsedLyrics = parseLyrics(currentSongLyrics);

  // Find current lyric line
  const currentLyricIndex = parsedLyrics.findIndex((line, index) => {
    const nextLine = parsedLyrics[index + 1];
    return line.time <= audioPlayer.currentTime && 
           (!nextLine || nextLine.time > audioPlayer.currentTime);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="h2">Player</h1>
        <p className="text-surface-600-400">
          {audioPlayer.currentSong ? 'Now playing' : 'Select a song to play'}
        </p>
      </div>

      {queue.currentSong ? (
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-8">
          {/* Left Column - Album Art and Info */}
          <div className="space-y-6">
            {/* Album Art */}
            <div className="aspect-square rounded-lg overflow-hidden shadow-xl">
              <img
                src={coverArtUrl}
                alt={queue.currentSong.metadata?.title || 'Unknown Title'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder-album.png';
                }}
              />
            </div>

            {/* Song Info */}
            <div className="text-center space-y-2">
              <h2 className="h3 font-bold">
                {queue.currentSong.metadata?.title || 'Unknown Title'}
              </h2>
              <p className="text-lg text-surface-600-400">
                {queue.currentSong.metadata?.artist || 'Unknown Artist'}
              </p>
              <p className="text-surface-500-500">
                {queue.currentSong.metadata?.album || 'Unknown Album'}
              </p>
              <div className="flex justify-center">
                <StatusBadge status={queue.currentSong.processingStatus} showIcon={false} />
              </div>
            </div>

            {/* Audio Version Selector */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-surface-600-400">Audio Version</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(AUDIO_VERSIONS).map(([key, version]) => (
                  <button
                    key={key}
                    disabled={!queue.currentSong || queue.currentSong.processingStatus !== 3} // Only completed songs
                    className={`btn ${
                      selectedVersion === key ? 'preset-filled' : 'preset-outline'
                    }`}
                    onClick={() => handleVersionChange(key as AudioVersionKey)}
                  >
                    {version.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Controls and Lyrics */}
          <div className="space-y-6">
            {/* Playback Controls */}
            <div className="card preset-tonal-surface p-6 space-y-4">
              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-surface-600-400">
                  <span>{formatTime(audioPlayer.currentTime)}</span>
                  <span>{formatTime(audioPlayer.duration)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={audioPlayer.duration || 0}
                  value={audioPlayer.currentTime}
                  onChange={(e) => audioPlayer.seek(Number(e.target.value))}
                  className="w-full h-2 bg-surface-200-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setShuffle(!shuffle)}
                  className={`btn preset-ghost ${shuffle ? 'text-primary-600' : ''}`}
                >
                  <ShuffleIcon size={20} />
                </button>

                <button
                  onClick={handlePrevious}
                  disabled={queue.currentIndex <= 0}
                  className="btn preset-outline"
                >
                  <SkipBackIcon size={24} />
                </button>

                <button
                  onClick={handlePlayPause}
                  className="btn preset-filled w-16 h-16 rounded-full flex items-center justify-center"
                >
                  {audioPlayer.isPlaying ? (
                    <PauseIcon size={32} />
                  ) : (
                    <PlayIcon size={32} />
                  )}
                </button>

                <button
                  onClick={handleNext}
                  disabled={!repeat && queue.currentIndex >= queue.items.length - 1}
                  className="btn preset-outline"
                >
                  <SkipForwardIcon size={24} />
                </button>

                <button
                  onClick={() => setRepeat(!repeat)}
                  className={`btn preset-ghost ${repeat ? 'text-primary-600' : ''}`}
                >
                  <RepeatIcon size={20} />
                </button>
              </div>

              {/* Volume and Additional Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleVolumeToggle}
                  className="btn preset-ghost flex items-center gap-2"
                >
                  {audioPlayer.volume > 0 ? (
                    <Volume2Icon size={16} />
                  ) : (
                    <VolumeXIcon size={16} />
                  )}
                  {Math.round(audioPlayer.volume * 100)}%
                </button>

                <div className="flex-1"></div>

                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.25"
                  value={audioPlayer.playbackRate}
                  onChange={(e) => audioPlayer.setPlaybackRate(Number(e.target.value))}
                  className="w-20 h-1 bg-surface-200-800 rounded-lg appearance-none cursor-pointer"
                  title="Playback Speed"
                />
                <span className="text-xs text-surface-600-400">
                  {audioPlayer.playbackRate}x
                </span>

                <button
                  onClick={handleDownload}
                  className="btn preset-ghost flex items-center gap-2"
                >
                  <DownloadIcon size={16} />
                  Download
                </button>
              </div>
            </div>

            {/* Lyrics Display */}
            <div className="card preset-tonal-surface p-6">
              <h3 className="text-lg font-medium mb-4">Lyrics</h3>
              <div className="h-64 overflow-y-auto space-y-2">
                {parsedLyrics.length > 0 ? (
                  parsedLyrics.map((line, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded transition-colors ${
                        index === currentLyricIndex
                          ? 'preset-tonal-primary text-primary-600 font-medium'
                          : index < currentLyricIndex
                          ? 'text-surface-400-600'
                          : 'text-surface-700-300'
                      }`}
                    >
                      {line.text}
                    </div>
                  ))
                ) : currentSongLyrics ? (
                  <div className="text-surface-600-400 whitespace-pre-wrap">
                    {currentSongLyrics}
                  </div>
                ) : (
                  <div className="text-center text-surface-400-600 py-8">
                    No lyrics available for this song
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="card preset-tonal-surface p-12 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface-200-800 flex items-center justify-center">
            <PlayIcon size={32} className="text-surface-400-600" />
          </div>
          <h3 className="h4 mb-2">No song playing</h3>
          <p className="text-surface-600-400 mb-4">
            Add songs to your queue to start playing
          </p>
          <Link 
            to="/"
            className="btn preset-filled"
          >
            Browse Songs
          </Link>
        </div>
      )}

      {/* Error Display */}
      {audioPlayer.error && (
        <div className="card preset-tonal-error p-4">
          <p className="font-medium">Playback Error</p>
          <p className="text-sm">{audioPlayer.error}</p>
        </div>
      )}
    </div>
  );
}