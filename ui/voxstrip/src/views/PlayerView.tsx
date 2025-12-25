import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Avatar, Slider, SegmentedControl } from '@skeletonlabs/skeleton-react';
import { toaster } from '../toaster.js';
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  VolumeXIcon,
  ListIcon
} from 'lucide-react';
import { VoxStripAPI } from '../api/client.js';
import { useAppContext } from '../router/context.js';
import {
  AUDIO_VERSIONS,
  DEFAULT_AUDIO_VERSION,
  type AudioVersionKey,
  getAudioVersionKeys,
} from '../config.js';
import { isProcessingComplete } from '../utils/statusHelpers.js';
import { getDominantColors } from '../utils/imageUtils.js';

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
  const [selectedVersion, setSelectedVersion] = useState<AudioVersionKey>(DEFAULT_AUDIO_VERSION);
  const [coverArtUrl, setCoverArtUrl] = useState('/placeholder-album.png');
  const [dominantColors, setDominantColors] = useState(['#1a1a1a', '#2d2d2d', '#404040']);
  const coverArtUrlRef = useRef<string | null>(null);



   
  useEffect(() => {
    if (!currentSong) {
      if (coverArtUrlRef.current) {
        URL.revokeObjectURL(coverArtUrlRef.current);
        coverArtUrlRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCoverArtUrl('/placeholder-album.png');
      setDominantColors(['#1a1a1a', '#2d2d2d', '#404040']);
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
        const blob = new Blob([new Uint8Array(response.image)], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        coverArtUrlRef.current = url;
        setCoverArtUrl(url);

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = async () => {
          if (!mounted) return;
          const colors = await getDominantColors(img);
          console.log('Dominant colors extracted:', colors);
          if (mounted) {
            setDominantColors(colors);
          }
        };
      } catch (error) {
        console.error('Failed to load cover art:', error);
        if (mounted) {
          setCoverArtUrl('/placeholder-album.png');
          setDominantColors(['#1a1a1a', '#2d2d2d', '#404040']);
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
   

  // Show error as toast when audioPlayer.error changes
  useEffect(() => {
    if (audioPlayer.error) {
      toaster.error({
        title: "Playback Error",
        description: audioPlayer.error
      });
    }
  }, [audioPlayer.error]);

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

    if (queue.currentIndex === queue.items.length - 1) {
      return;
    }

    queue.playNext();
  };

  const handlePrevious = () => {
    queue.playPrevious();
  };

  // handleSeek is no longer needed since we use Slider's onValueChange

  const canSkipBackward = queue.currentIndex > 0;
  const canSkipForward = queue.currentIndex < queue.items.length - 1;

  // Prepare lyrics sections for centered display
  const previousLyrics = lyricsLines.slice(Math.max(0, currentLyricIndex - 2), currentLyricIndex);
  const currentLyric = currentLyricIndex >= 0 ? lyricsLines[currentLyricIndex]?.text : '';
  const nextLyrics = lyricsLines.slice(currentLyricIndex + 1, currentLyricIndex + 3);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentSong) {
    return (
      <div className="min-h-[100vh] flex items-center justify-center p-4 sm:p-8 pb-[180px] sm:pb-[200px]">
        <div className="card preset-tonal-surface p-12 text-center max-w-md">
          <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-surface-200-800 flex items-center justify-center">
            <div className="w-16 h-16 bg-surface-400-600 rounded-full flex items-center justify-center">
              <PlayIcon className="w-8 h-8 text-surface-600-400" />
            </div>
          </div>
          <h3 className="h2 mb-4">No song playing</h3>
          <p className="text-surface-600-400 mb-8">Add songs to your queue to start playing</p>
          <Link to="/" className="btn preset-filled">
            Browse Songs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fixed background setup: gradient covers entire viewport including sidebar area.
         The <main> element in App.tsx has no background to allow this to show through.
         Gradient uses dominant colors from album art extracted at load time. */}
      <div
        className="fixed inset-0 -z-50"
        style={{
          background: `linear-gradient(135deg, ${dominantColors[0]}, ${dominantColors[1]}, ${dominantColors[2]})`,
        }}
      />
      {/* Overlay to darken background for better text readability */}
      <div className="fixed inset-0 -z-40" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} />

      <div className="min-h-[100vh] flex flex-col relative overflow-hidden">
        {/* Full-height Lyrics Display */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 pb-[180px] sm:pb-[200px] overflow-hidden relative z-10">
          <div className="max-w-5xl w-full space-y-6 sm:space-y-8">
            {/* Previous lyrics - faded */}
            <div className="space-y-2 text-center opacity-40 min-h-[80px]">
              {previousLyrics.map((line, index) => (
                <p key={`prev-${line.time}-${index}`} className="text-xl sm:text-2xl md:text-3xl font-light text-white">
                  {line.text}
                </p>
              ))}
            </div>

            {/* Current lyric - highlighted and large */}
            <div className="text-center min-h-[120px] flex items-center justify-center">
              {currentLyric && (
                <p className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white
                               transition-all duration-500 transform scale-105 px-4 drop-shadow-2xl">
                  {currentLyric}
                </p>
              )}
            </div>

            {/* Next lyrics - visible but muted */}
            <div className="space-y-2 text-center opacity-60 min-h-[100px]">
              {nextLyrics.map((line, index) => (
                <p key={`next-${line.time}-${index}`} className="text-lg sm:text-xl md:text-2xl font-medium text-white">
                  {line.text}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Fixed Bottom Controls Bar - Spans full width of main area */}
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 flex-shrink-0 bg-surface-100-900/90 backdrop-blur-sm border-t border-surface-200-800 shadow-lg z-40">
          <div className="p-4 sm:p-6 w-full">
            {/* Progress Bar - Time labels */}
            <div className="mb-2 w-full">
              <div className="flex justify-between text-xs sm:text-sm font-mono text-surface-600-400">
                <span>{formatTime(audioPlayer.currentTime)}</span>
                <span>{formatTime(audioPlayer.duration || 0)}</span>
              </div>
            </div>

            {/* Progress Bar - Using Skeleton Slider */}
            <div className="mb-4 w-full">
              <Slider
                value={[audioPlayer.currentTime || 0]}
                max={audioPlayer.duration || 100}
                step={1}
                onValueChange={(details) => audioPlayer.seek(details.value[0])}
                className="w-full"
              >
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Range />
                  </Slider.Track>
                  <Slider.Thumb index={0}>
                    <Slider.HiddenInput />
                  </Slider.Thumb>
                </Slider.Control>
              </Slider>
            </div>

            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 w-full">
              {/* Left Side: Song Info and Basic Controls */}
              <div className="flex items-center gap-4 flex-shrink-0">
                {/* Album Art */}
                <Avatar className="w-12 h-12 flex-shrink-0">
                  <Avatar.Image src={coverArtUrl} alt="Album art" />
                  <Avatar.Fallback className="text-lg">♪</Avatar.Fallback>
                </Avatar>

                {/* Song Info */}
                <div className="w-56 hidden sm:block">
                  <h2 className="font-semibold text-sm truncate">{currentSong.metadata?.title || 'Unknown Title'}</h2>
                  <p className="text-xs text-surface-600-400 truncate">{currentSong.metadata?.artist || 'Unknown Artist'}</p>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevious}
                    disabled={!canSkipBackward}
                    className="btn btn-icon btn-icon-sm preset-tonal disabled:opacity-50"
                  >
                    <SkipBackIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="btn btn-icon btn-icon-lg preset-filled shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    {queue.isPlaying ? (
                      <PauseIcon className="w-6 h-6" />
                    ) : (
                      <PlayIcon className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!canSkipForward}
                    className="btn btn-icon btn-icon-sm preset-tonal disabled:opacity-50"
                  >
                    <SkipForwardIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Center: Audio Version Selection - Using Skeleton SegmentedControl */}
              <div className="flex-1 flex justify-center lg:px-4 min-w-0">
                <SegmentedControl
                  value={selectedVersion}
                  onValueChange={(details) => handleVersionChange(details.value as AudioVersionKey)}
                  disabled={!isProcessingComplete(currentSong.processingStatus)}
                  className="w-full"
                >
                  <SegmentedControl.Control>
                    <SegmentedControl.Indicator />
                    {getAudioVersionKeys().map((key) => (
                      <SegmentedControl.Item key={key} value={key}>
                        <SegmentedControl.ItemText className="text-xs sm:text-sm">
                          {AUDIO_VERSIONS[key].label}
                        </SegmentedControl.ItemText>
                        <SegmentedControl.ItemHiddenInput />
                      </SegmentedControl.Item>
                    ))}
                  </SegmentedControl.Control>
                </SegmentedControl>
              </div>

              {/* Right Side: Volume and Additional Controls */}
              <div className="flex items-center justify-end gap-3 flex-shrink-0">

                {/* Volume Control */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => audioPlayer.setVolume(audioPlayer.volume > 0 ? 0 : 1)}
                    className="btn btn-icon preset-ghost"
                  >
                    {audioPlayer.volume > 0 ? (
                      <Volume2Icon className="w-4 h-4" />
                    ) : (
                      <VolumeXIcon className="w-4 h-4" />
                    )}
                  </button>
                  <div className="w-24">
                    <Slider
                      value={[audioPlayer.volume]}
                      max={1}
                      step={0.05}
                      onValueChange={(details) => audioPlayer.setVolume(details.value[0])}
                    />
                  </div>
                </div>

                {/* Queue Button */}
                <Link to="/queue" className="btn btn-icon preset-tonal" title="View Queue">
                  <ListIcon className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
