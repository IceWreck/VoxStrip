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
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 50, 100, 500],

  // Audio
  AUDIO_SEEK_STEP: 5,
} as const;

// Re-export audio version utilities from central module
export {
  AUDIO_VERSIONS,
  type AudioVersionKey,
  type AudioVersionInfo,
  versionKeyToEnum,
  enumToVersionKey,
  getAudioVersionInfo,
  getAudioVersionKeys,
  DEFAULT_AUDIO_VERSION,
} from './utils/audioVersions.js';

// Re-export status helpers from utilities
export {
  STATUS_BADGE_CONFIG,
  getStatusBadgeConfig,
  isProcessingComplete,
  isProcessing,
  isProcessingFailed,
  isProcessingPending,
} from './utils/statusHelpers.js';
