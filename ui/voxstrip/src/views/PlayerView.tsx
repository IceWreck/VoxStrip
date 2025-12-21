import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { VoxStripAPI } from '../api/client.js';
import StatusBadge from '../components/StatusBadge.js';
import PlayerControls from '../components/player/PlayerControls.js';
import PlayerDetails from '../components/player/PlayerDetails.js';
import { useAppContext } from '../router/context.js';
import {
  AUDIO_VERSIONS,
  DEFAULT_AUDIO_VERSION,
  type AudioVersionKey,
} from '../config.js';

type LyricLine = {
  time: number;
  text: string;
};

const parseLyrics = (lyrics?: string): LyricLine[] => {
  if (!lyrics) return [];

  const lines = lyrics.split('\n');
  const parsed: LyricLine[] = [];

  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const milliseconds = Number(match[3].padEnd(3, '0').slice(0, 3));
      const time = minutes * 60 + seconds + milliseconds / 1000;
      const text = match[4].trim();
      if (text) {
        parsed.push({ time, text });
      }
    } else if (line.trim()) {
      parsed.push({ time: -1, text: line.trim() });
    }
  }

  return parsed;
};

export default function PlayerView() {
  const { queue, audioPlayer } = useAppContext();
  const currentSong = queue.currentSong;
  const currentSongId = currentSong?.songId ?? null;
  const [selectedVersion, setSelectedVersion] = useState<AudioVersionKey>(DEFAULT_AUDIO_VERSION);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [coverArtUrl, setCoverArtUrl] = useState('/placeholder-album.png');
  const songIdRef = useRef<string | null>(null);
  const coverArtUrlRef = useRef<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (currentSongId !== songIdRef.current) {
      songIdRef.current = currentSongId;
      setSelectedVersion(DEFAULT_AUDIO_VERSION);
    }
  }, [currentSongId]);

  useEffect(() => {
    if (!currentSong) {
      if (coverArtUrlRef.current) {
        URL.revokeObjectURL(coverArtUrlRef.current);
        coverArtUrlRef.current = null;
      }
      setCoverArtUrl('/placeholder-album.png');
      return;
    }

    let mounted = true;

    const loadCoverArt = async () => {
      try {
        const response = await VoxStripAPI.getCoverArt(currentSong.songId);
        if (!mounted) return;
        if (coverArtUrlRef.current) {
          URL.revokeObjectURL(coverArtUrlRef.current);
        }
        const blob = new Blob([response.image], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        coverArtUrlRef.current = url;
        setCoverArtUrl(url);
      } catch (error) {
        console.error('Failed to load cover art:', error);
        if (mounted) {
          setCoverArtUrl('/placeholder-album.png');
        }
        if (coverArtUrlRef.current) {
          URL.revokeObjectURL(coverArtUrlRef.current);
          coverArtUrlRef.current = null;
        }
      }
    };

    loadCoverArt();

    return () => {
      mounted = false;
    };
  }, [currentSong]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const song = currentSong;
    if (!song) return;
    if (audioPlayer.currentSong?.songId !== song.songId) return;
    if (audioPlayer.currentVersion === selectedVersion) return;
    audioPlayer.loadSong(song, selectedVersion);
  }, [selectedVersion, currentSong, audioPlayer]);

  useEffect(() => () => {
    if (coverArtUrlRef.current) {
      URL.revokeObjectURL(coverArtUrlRef.current);
    }
  }, []);

  const lyricsLines = useMemo(
    () => parseLyrics(currentSong?.metadata?.lyrics),
    [currentSong?.metadata?.lyrics],
  );

  const currentLyricIndex = useMemo(() => {
    return lyricsLines.findIndex((line, index) => {
      const next = lyricsLines[index + 1];
      return line.time >= 0 && line.time <= audioPlayer.currentTime && (!next || next.time > audioPlayer.currentTime);
    });
  }, [lyricsLines, audioPlayer.currentTime]);

  const handleVersionChange = (version: AudioVersionKey) => {
    setSelectedVersion(version);
  };

  const handlePlayPause = () => {
    if (!currentSong) {
      if (queue.items.length > 0) {
        queue.jumpToIndex(0);
      }
      return;
    }

    queue.setIsPlaying(!queue.isPlaying);
  };

  const handleNext = () => {
    if (queue.items.length === 0) return;

    if (shuffle && queue.items.length > 1) {
      const choices = queue.items
        .map((_, index) => index)
        .filter(index => index !== queue.currentIndex);
      const nextIndex = choices[Math.floor(Math.random() * choices.length)];
      queue.jumpToIndex(nextIndex);
      return;
    }

    if (queue.currentIndex === queue.items.length - 1) {
      if (repeat) {
        queue.jumpToIndex(0);
      }
      return;
    }

    queue.playNext();
  };

  const handlePrevious = () => {
    queue.playPrevious();
  };

  const handleDownload = async () => {
    if (!currentSong) return;

    try {
      const response = await VoxStripAPI.downloadAudio({
        songId: currentSong.songId,
        version: selectedVersion.toLowerCase() as 'original' | 'vocal' | 'instrumental' | 'karaoke',
        format: 'mp3',
        bitrate: 320,
      });

      const audioBlob = new Blob([response.audio], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(audioBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.filename || `${currentSong.metadata?.title || 'unknown'}-${selectedVersion}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const canSkipBackward = queue.currentIndex > 0;
  const canSkipForward = shuffle || repeat || queue.currentIndex < queue.items.length - 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="h2">Player</h1>
        <p className="text-surface-600-400">
          {audioPlayer.currentSong ? 'Now playing' : 'Select a song to play'}
        </p>
      </div>

      {currentSong ? (
        <div className="grid lg:grid-cols-[1fr_1.5fr] gap-8">
          <div className="space-y-6">
            <PlayerDetails
              song={currentSong}
              coverArtUrl={coverArtUrl}
              onImageError={() => setCoverArtUrl('/placeholder-album.png')}
            />

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-surface-600-400">Audio Version</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(AUDIO_VERSIONS).map(([key, version]) => (
                  <button
                    key={key}
                    disabled={currentSong.processingStatus !== 3}
                    className={`btn ${selectedVersion === key ? 'preset-filled' : 'preset-outline'}`}
                    onClick={() => handleVersionChange(key as AudioVersionKey)}
                  >
                    {version.label}
                  </button>
                ))}
              </div>
              <div className="text-sm text-surface-500-500">
                <StatusBadge status={currentSong.processingStatus} showIcon={false} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <PlayerControls
              audioPlayer={audioPlayer}
              repeat={repeat}
              shuffle={shuffle}
              onToggleRepeat={() => setRepeat(prev => !prev)}
              onToggleShuffle={() => setShuffle(prev => !prev)}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onPlayPause={handlePlayPause}
              onDownload={handleDownload}
              canSkipBackward={canSkipBackward}
              canSkipForward={canSkipForward}
            />

            <div className="card preset-tonal-surface p-6">
              <h3 className="text-lg font-medium mb-4">Lyrics</h3>
              <div className="h-64 overflow-y-auto space-y-2">
                {lyricsLines.length > 0 ? (
                  lyricsLines.map((line, index) => (
                    <div
                      key={`${line.time}-${index}`}
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
                ) : currentSong.metadata?.lyrics ? (
                  <div className="text-surface-600-400 whitespace-pre-wrap">
                    {currentSong.metadata.lyrics}
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
        <div className="card preset-tonal-surface p-12 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface-200-800 flex items-center justify-center">
            <div className="w-10 h-10 bg-surface-400-600 rounded-full"></div>
          </div>
          <h3 className="h4 mb-2">No song playing</h3>
          <p className="text-surface-600-400 mb-4">Add songs to your queue to start playing</p>
          <Link to="/" className="btn preset-filled">
            Browse Songs
          </Link>
        </div>
      )}

      {audioPlayer.error && (
        <div className="card preset-tonal-error p-4">
          <p className="font-medium">Playback Error</p>
          <p className="text-sm">{audioPlayer.error}</p>
        </div>
      )}
    </div>
  );
}
