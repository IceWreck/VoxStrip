import { AudioVersion } from '../proto/server_pb.js';

// Audio version metadata aligned with generated AudioVersion enum
export const AUDIO_VERSIONS = {
  ORIGINAL: {
    enum: AudioVersion.ORIGINAL,
    key: 'original',
    label: 'Original',
    description: 'Original audio file',
  },
  VOCAL: {
    enum: AudioVersion.VOCAL,
    key: 'vocal',
    label: 'Vocal',
    description: 'Vocal-only version',
  },
  INSTRUMENTAL: {
    enum: AudioVersion.INSTRUMENTAL,
    key: 'instrumental',
    label: 'Instrumental',
    description: 'Instrumental-only version',
  },
  KARAOKE: {
    enum: AudioVersion.KARAOKE,
    key: 'karaoke',
    label: 'Karaoke',
    description: 'Karaoke version with vocals reduced',
  },
} as const;

export type AudioVersionKey = keyof typeof AUDIO_VERSIONS;
export type AudioVersionInfo = typeof AUDIO_VERSIONS[AudioVersionKey];

// Convert version key to proto enum
export const versionKeyToEnum = (key: AudioVersionKey): AudioVersion => {
  return AUDIO_VERSIONS[key].enum;
};

// Convert proto enum to version key
export const enumToVersionKey = (enumValue: AudioVersion): AudioVersionKey | null => {
  const entry = Object.values(AUDIO_VERSIONS).find(v => v.enum === enumValue);
  return entry ? entry.key as AudioVersionKey : null;
};

// Get version info by proto enum
export const getAudioVersionInfo = (enumValue: AudioVersion): AudioVersionInfo | null => {
  const entry = Object.values(AUDIO_VERSIONS).find(v => v.enum === enumValue);
  return entry || null;
};

// Get all version keys ordered by display preference
export const getAudioVersionKeys = (): AudioVersionKey[] => {
  return Object.keys(AUDIO_VERSIONS) as AudioVersionKey[];
};

// Default version for UI and player
export const DEFAULT_AUDIO_VERSION: AudioVersionKey = 'INSTRUMENTAL';