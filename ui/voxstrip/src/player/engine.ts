// PlayerEngine drives audio playback with two synchronized elements: the
// music track (instrumental stem or original file) and an optional vocal stem
// blended on top. This enables live vocal-guide fading without re-downloading
// or interrupting playback. Framework-free; the React store subscribes via
// callbacks.

import { mediaUrl } from '../api/client';

export type PlayMode = 'stems' | 'original';

export interface EngineState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
}

// Maximum drift between music and vocal elements before a hard resync.
const DRIFT_TOLERANCE_SECONDS = 0.25;

export class PlayerEngine {
  // Callbacks are assigned by the owning store after construction so the
  // engine can live as a module singleton across provider remounts.
  onChange: ((state: EngineState) => void) | null = null;
  onEnded: (() => void) | null = null;

  private music = new Audio();
  private vocals = new Audio();
  private songId: string | null = null;
  private mode: PlayMode = 'stems';
  private volume = 1;
  private vocalLevel = 0;
  private vocalsAvailable = false;
  private loading = false;
  private lastError: string | null = null;

  constructor() {
    this.music.preload = 'auto';
    this.vocals.preload = 'auto';

    this.music.addEventListener('loadstart', () => {
      this.loading = true;
      this.emit();
    });
    this.music.addEventListener('canplay', () => {
      this.loading = false;
      this.emit();
    });
    this.music.addEventListener('timeupdate', () => {
      this.correctDrift();
      this.emit();
    });
    this.music.addEventListener('durationchange', () => this.emit());
    this.music.addEventListener('play', () => this.emit());
    this.music.addEventListener('pause', () => {
      this.vocals.pause();
      this.emit();
    });
    this.music.addEventListener('ended', () => {
      this.vocals.pause();
      this.emit();
      this.onEnded?.();
    });
    this.music.addEventListener('error', () => {
      if (!this.songId) return;
      this.loading = false;
      this.lastError = this.music.error?.message || 'failed to load audio';
      this.emit();
    });

    // A missing or broken vocal stem downgrades to music-only playback
    // instead of failing the whole song.
    this.vocals.addEventListener('error', () => {
      this.vocalsAvailable = false;
    });
  }

  get state(): EngineState {
    return {
      isPlaying: !this.music.paused && !this.music.ended,
      isLoading: this.loading,
      currentTime: this.music.currentTime,
      duration: Number.isFinite(this.music.duration) ? this.music.duration : 0,
      error: this.lastError,
    };
  }

  // load points the engine at a song. Reloading the current song in a
  // different mode resumes seamlessly at the same position and play state.
  load(songId: string, mode: PlayMode, options: { autoplay?: boolean } = {}): void {
    const sameSong = songId === this.songId;
    if (sameSong && mode === this.mode) return;

    const resumeAt = sameSong ? this.music.currentTime : 0;
    const shouldPlay = (options.autoplay ?? false) || (sameSong && !this.music.paused);

    this.songId = songId;
    this.mode = mode;
    this.lastError = null;
    this.loading = true;

    this.music.src = mediaUrl.audio(songId, mode === 'stems' ? 'instrumental' : 'original');
    if (mode === 'stems') {
      this.vocalsAvailable = true;
      this.vocals.src = mediaUrl.audio(songId, 'vocal');
      this.vocals.load();
    } else {
      this.vocalsAvailable = false;
      this.vocals.removeAttribute('src');
    }
    this.applyVolumes();
    this.music.load();

    if (resumeAt > 0) this.music.currentTime = resumeAt;
    if (shouldPlay) this.play();
    this.emit();
  }

  // unload stops playback and releases the current song.
  unload(): void {
    this.songId = null;
    this.music.pause();
    this.vocals.pause();
    this.music.removeAttribute('src');
    this.vocals.removeAttribute('src');
    this.lastError = null;
    this.loading = false;
    this.emit();
  }

  play(): void {
    if (!this.songId) return;
    this.music.play().catch((error: unknown) => {
      this.lastError = error instanceof Error ? error.message : 'playback failed';
      this.emit();
    });
    if (this.mode === 'stems' && this.vocalsAvailable) {
      this.vocals.currentTime = this.music.currentTime;
      this.vocals.play().catch(() => {
        this.vocalsAvailable = false;
      });
    }
  }

  pause(): void {
    this.music.pause();
  }

  seek(seconds: number): void {
    const clamped = Math.max(0, Math.min(seconds, this.state.duration || seconds));
    this.music.currentTime = clamped;
    this.vocals.currentTime = clamped;
    this.emit();
  }

  seekBy(deltaSeconds: number): void {
    this.seek(this.music.currentTime + deltaSeconds);
  }

  setVolume(volume: number): void {
    this.volume = clamp01(volume);
    this.applyVolumes();
  }

  // setVocalLevel adjusts the guide-vocal blend from 0 (karaoke) to 1 (full).
  setVocalLevel(level: number): void {
    this.vocalLevel = clamp01(level);
    this.applyVolumes();
  }

  private applyVolumes(): void {
    this.music.volume = this.volume;
    this.vocals.volume = clamp01(this.volume * this.vocalLevel);
  }

  private correctDrift(): void {
    if (this.mode !== 'stems' || !this.vocalsAvailable || this.music.paused) return;
    const drift = Math.abs(this.vocals.currentTime - this.music.currentTime);
    if (drift > DRIFT_TOLERANCE_SECONDS) {
      this.vocals.currentTime = this.music.currentTime;
    }
  }

  private emit(): void {
    this.onChange?.(this.state);
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
