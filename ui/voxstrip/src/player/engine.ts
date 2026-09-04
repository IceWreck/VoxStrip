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

// Drift beyond this gets a hard resync of the vocal element.
const DRIFT_HARD_LIMIT_SECONDS = 0.25;
// Smaller drift is corrected gently by nudging the vocal playback rate,
// which is inaudible; hard seeks on every correction would glitch.
const DRIFT_NUDGE_THRESHOLD_SECONDS = 0.03;

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
    // Vocals follow the music element's actual playback state, so they can
    // never run ahead while the music is still buffering.
    this.music.addEventListener('playing', () => {
      this.startVocals();
      this.emit();
    });
    this.music.addEventListener('waiting', () => this.vocals.pause());
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
  // different mode resumes seamlessly at the same position and play state;
  // reloading after an error retries from scratch.
  load(songId: string, mode: PlayMode, options: { autoplay?: boolean } = {}): void {
    const sameSong = songId === this.songId;
    if (sameSong && mode === this.mode && !this.lastError) return;

    const resumeAt = sameSong && !this.lastError ? this.music.currentTime : 0;
    const shouldPlay = (options.autoplay ?? false) || (sameSong && !this.music.paused);

    // Stop both elements before swapping sources: changing music.src mid-play
    // does not fire a pause event, so the vocals would keep playing.
    this.music.pause();
    this.vocals.pause();

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
      this.vocals.load();
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
    this.music.load();
    this.vocals.removeAttribute('src');
    this.vocals.load();
    this.lastError = null;
    this.loading = false;
    this.emit();
  }

  play(): void {
    if (!this.songId) return;

    // After a load error the sources are stale; retry from scratch instead
    // of playing a dead element.
    if (this.lastError) {
      const songId = this.songId;
      this.songId = null;
      this.load(songId, this.mode, { autoplay: true });
      return;
    }

    // Vocals are started by the 'playing' event handler once the music is
    // actually rolling.
    this.music.play().catch((error: unknown) => {
      // A play() interrupted by a newer load is not a real failure.
      if (isAbortError(error)) return;
      this.lastError = error instanceof Error ? error.message : 'playback failed';
      this.emit();
    });
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

  private startVocals(): void {
    if (this.mode !== 'stems' || !this.vocalsAvailable) return;
    this.vocals.currentTime = this.music.currentTime;
    this.vocals.play().catch((error: unknown) => {
      // Interrupted or autoplay-blocked attempts should not permanently
      // disable the vocal stem; only genuine load failures do (handled by
      // the element's error listener).
      if (isAbortError(error)) return;
      if (error instanceof DOMException && error.name === 'NotAllowedError') return;
      this.vocalsAvailable = false;
    });
  }

  private applyVolumes(): void {
    this.music.volume = this.volume;
    this.vocals.volume = clamp01(this.volume * this.vocalLevel);
  }

  private correctDrift(): void {
    if (this.mode !== 'stems' || !this.vocalsAvailable || this.music.paused) return;
    const drift = this.vocals.currentTime - this.music.currentTime;

    if (Math.abs(drift) > DRIFT_HARD_LIMIT_SECONDS) {
      this.vocals.currentTime = this.music.currentTime;
      this.vocals.playbackRate = 1;
    } else if (Math.abs(drift) > DRIFT_NUDGE_THRESHOLD_SECONDS) {
      this.vocals.playbackRate = drift > 0 ? 0.97 : 1.03;
    } else {
      this.vocals.playbackRate = 1;
    }
  }

  private emit(): void {
    this.onChange?.(this.state);
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
