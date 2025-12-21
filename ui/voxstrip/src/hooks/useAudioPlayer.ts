import { useState, useRef, useEffect, useCallback } from 'react';
import type { Song } from '../api/client.js';
import type { AudioVersionKey } from '../config.js';
import { UI_CONFIG, DEFAULT_AUDIO_VERSION } from '../config.js';
import { VoxStripAPI } from '../api/client.js';

export interface AudioPlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  error: string | null;
  currentVersion: AudioVersionKey;
  playbackRate: number;
  isMuted: boolean;
}

export interface AudioPlayerActions {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleMute: () => void;
  loadSong: (song: Song, version?: AudioVersionKey) => Promise<void>;
  seekForward: () => void;
  seekBackward: () => void;
}

export function useAudioPlayer(): AudioPlayerState & AudioPlayerActions {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isLoading: false,
    error: null,
    currentVersion: 'INSTRUMENTAL',
    playbackRate: 1,
    isMuted: false,
  });

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    
    // Set up event listeners
    const handleLoadStart = () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
    };

    const handleCanPlay = () => {
      setState(prev => ({ ...prev, isLoading: false, error: null }));
    };

    const handleError = () => {
      if (audioRef.current?.error) {
        const errorMessage = audioRef.current.error.message || 'Unknown error occurred';
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: errorMessage,
          isPlaying: false 
        }));
      }
    };

    const handleTimeUpdate = () => {
      setState(prev => ({ 
        ...prev, 
        currentTime: audio.currentTime,
        duration: audio.duration || 0 
      }));
    };

    const handleEnded = () => {
      setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
    };

    const handleLoadedMetadata = () => {
      setState(prev => ({ 
        ...prev, 
        duration: audio.duration || 0,
        currentTime: audio.currentTime
      }));
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    audioRef.current = audio;

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.pause();
      audio.src = '';
      // Clean up blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Play
  const play = useCallback(() => {
    if (audioRef.current && state.currentSong && !state.error) {
      audioRef.current.play().catch(error => {
        setState(prev => ({ 
          ...prev, 
          error: `Failed to play: ${error.message}` 
        }));
      });
    }
  }, [state.currentSong, state.error]);

  // Pause
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  // Seek to time
  const seek = useCallback((time: number) => {
    if (audioRef.current && time >= 0 && time <= state.duration) {
      audioRef.current.currentTime = time;
      setState(prev => ({ ...prev, currentTime: time }));
    }
  }, [state.duration]);

  // Set volume
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
      audioRef.current.muted = false; // Unmute when changing volume
    }
    setState(prev => ({ 
      ...prev, 
      volume: clampedVolume,
      isMuted: false 
    }));
  }, []);

  // Set playback rate
  const setPlaybackRate = useCallback((rate: number) => {
    const clampedRate = Math.max(0.25, Math.min(2, rate));
    if (audioRef.current) {
      audioRef.current.playbackRate = clampedRate;
    }
    setState(prev => ({ ...prev, playbackRate: clampedRate }));
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !state.isMuted;
      setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }
  }, [state.isMuted]);

  // Load a new song
  const loadSong = useCallback(async (song: Song, version: AudioVersionKey = DEFAULT_AUDIO_VERSION) => {
    if (!audioRef.current) return;

    try {
      setState(prev => ({ 
        ...prev, 
        isLoading: true, 
        error: null,
        currentSong: song,
        currentVersion: version,
        isPlaying: false 
      }));

      // Download audio data for specific version
      const response = await VoxStripAPI.downloadAudio({
        songId: song.songId,
        version: version.toLowerCase() as 'original' | 'vocal' | 'instrumental' | 'karaoke',
        format: 'mp3',
        bitrate: 320
      });

      // Create blob URL from audio data
      const audioBlob = new Blob([response.audio], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Clean up old blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      blobUrlRef.current = audioUrl;
      audioRef.current.src = audioUrl;
      
      // Wait for audio to load metadata
      await new Promise((resolve, reject) => {
        const handleCanPlay = () => {
          if (audioRef.current) {
            audioRef.current.removeEventListener('canplay', handleCanPlay);
            audioRef.current.removeEventListener('error', handleError);
          }
          resolve(void 0);
        };
        
        const handleError = () => {
          if (audioRef.current) {
            audioRef.current.removeEventListener('canplay', handleCanPlay);
            audioRef.current.removeEventListener('error', handleError);
          }
          reject(new Error('Failed to load audio'));
        };
        
        if (audioRef.current) {
          audioRef.current.addEventListener('canplay', handleCanPlay);
          audioRef.current.addEventListener('error', handleError);
        }
      });

      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        isPlaying: false 
      }));

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: `Failed to load song: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isPlaying: false 
      }));
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seek forward
  const seekForward = useCallback(() => {
    const newTime = Math.min(state.currentTime + UI_CONFIG.AUDIO_SEEK_STEP, state.duration);
    seek(newTime);
  }, [state.currentTime, state.duration, seek]);

  // Seek backward
  const seekBackward = useCallback(() => {
    const newTime = Math.max(state.currentTime - UI_CONFIG.AUDIO_SEEK_STEP, 0);
    seek(newTime);
  }, [state.currentTime, seek]);

  // Update isPlaying state when audio play/pause events occur
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setState(prev => ({ ...prev, isPlaying: true }));
    const handlePause = () => setState(prev => ({ ...prev, isPlaying: false }));

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  return {
    ...state,
    play,
    pause,
    togglePlayPause,
    seek,
    setVolume,
    setPlaybackRate,
    toggleMute,
    loadSong,
    seekForward,
    seekBackward,
  };
}