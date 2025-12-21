import { ProcessingStatus } from '../proto/server_pb.js';

export const STATUS_BADGE_CONFIG = {
  [ProcessingStatus.UNSPECIFIED]: {
    preset: 'preset-tonal-surface',
    text: 'Pending',
    icon: 'Clock',
  },
  [ProcessingStatus.PENDING]: {
    preset: 'preset-tonal-surface',
    text: 'Pending',
    icon: 'Clock',
  },
  [ProcessingStatus.PROCESSING]: {
    preset: 'preset-tonal-warning',
    text: 'Processing',
    icon: 'Loader2',
  },
  [ProcessingStatus.COMPLETED]: {
    preset: 'preset-tonal-success',
    text: 'Completed',
    icon: 'Check',
  },
  [ProcessingStatus.FAILED]: {
    preset: 'preset-tonal-error',
    text: 'Failed',
    icon: 'X',
  },
} as const;

// Get badge config by processing status
export const getStatusBadgeConfig = (status: ProcessingStatus) => {
  return STATUS_BADGE_CONFIG[status] || STATUS_BADGE_CONFIG[ProcessingStatus.UNSPECIFIED];
};

// Helper to check if a song can be played/downloaded
export const isProcessingComplete = (status: ProcessingStatus): boolean => {
  return status === ProcessingStatus.COMPLETED;
};

// Helper to check if a song is still being processed
export const isProcessing = (status: ProcessingStatus): boolean => {
  return status === ProcessingStatus.PROCESSING;
};

// Helper to check if processing failed
export const isProcessingFailed = (status: ProcessingStatus): boolean => {
  return status === ProcessingStatus.FAILED;
};

// Helper to check if processing is pending or unspecified
export const isProcessingPending = (status: ProcessingStatus): boolean => {
  return status === ProcessingStatus.PENDING || status === ProcessingStatus.UNSPECIFIED;
};