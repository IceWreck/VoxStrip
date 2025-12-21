// UI Configuration for VoxStrip

// API Configuration
export const API_CONFIG = {
  // Hardcoded backend URL to avoid proxy complications
  // Can override with environment variable if needed
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  TIMEOUT_MS: 30000,
} as const;

// UI Constants
export const UI_CONFIG = {
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  
  // Search
  SEARCH_DEBOUNCE_MS: 300,
  
  // Audio
  AUDIO_VOLUME_STEP: 0.1,
  AUDIO_SEEK_STEP: 5, // seconds
  
  // File uploads
  MAX_FILE_SIZE_MB: 100,
  SUPPORTED_AUDIO_FORMATS: ['mp3', 'wav', 'flac', 'aac', 'ogg'],
} as const;

// Audio Version Types for UI display
export const AUDIO_VERSIONS = {
  ORIGINAL: {
    key: 'original',
    label: 'Original',
    description: 'Original audio file',
  },
  VOCAL: {
    key: 'vocal',
    label: 'Vocal',
    description: 'Vocal-only version',
  },
  INSTRUMENTAL: {
    key: 'instrumental',
    label: 'Instrumental',
    description: 'Instrumental-only version',
  },
  KARAOKE: {
    key: 'karaoke',
    label: 'Karaoke',
    description: 'Karaoke version with vocals reduced',
  },
} as const;

export type AudioVersionKey = keyof typeof AUDIO_VERSIONS;

export const DEFAULT_AUDIO_VERSION: AudioVersionKey = 'INSTRUMENTAL';

// Navigation views
export const VIEWS = {
  SONGS: 'songs',
  QUEUE: 'queue',
  PLAYER: 'player',
  IMPORT: 'import',
} as const;

export type ViewKey = keyof typeof VIEWS;

// Processing Status Badge Configuration
export const STATUS_BADGE_CONFIG = {
  PROCESSING_STATUS_UNSPECIFIED: {
    preset: 'preset-tonal-surface',
    text: 'Pending',
    icon: 'Clock',
  },
  PROCESSING_STATUS_PENDING: {
    preset: 'preset-tonal-surface',
    text: 'Pending',
    icon: 'Clock',
  },
  PROCESSING_STATUS_PROCESSING: {
    preset: 'preset-tonal-warning',
    text: 'Processing',
    icon: 'Loader2',
  },
  PROCESSING_STATUS_COMPLETED: {
    preset: 'preset-tonal-success',
    text: 'Completed',
    icon: 'Check',
  },
  PROCESSING_STATUS_FAILED: {
    preset: 'preset-tonal-error',
    text: 'Failed',
    icon: 'X',
  },
} as const;

// Default export for easy importing
export default {
  API: API_CONFIG,
  UI: UI_CONFIG,
  AUDIO_VERSIONS,
  VIEWS,
  STATUS_BADGE_CONFIG,
} as const;
