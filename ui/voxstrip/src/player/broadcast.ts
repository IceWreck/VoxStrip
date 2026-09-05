// Cross-window messaging between the main app (which owns audio and controls)
// and read-only stage display windows, over a BroadcastChannel.

import type { SampleState, ScoreSummary } from '../lib/scoring';

export const STAGE_CHANNEL = 'voxstrip:stage';

// StageSong carries everything a stage window needs to render a song without
// its own API access to player state.
export interface StageSong {
  songId: string;
  title: string;
  artist: string;
  lyrics: string;
}

export type StageMessage =
  // Published by the main window on every player state change.
  | {
      type: 'state';
      song: StageSong | null;
      isPlaying: boolean;
      currentTime: number;
      duration: number;
      lyricsOffsetMs: number;
    }
  // Published by the main window while singing scoring is active.
  | {
      type: 'score';
      active: boolean;
      score: number;
      combo: number;
      accuracy: number;
      lastLine: { index: number; rating: string } | null;
      finished: boolean;
    }
  // One mic pitch reading, published per sample (~33/s) while scoring is
  // active so stage windows can draw the live pitch trace.
  | {
      type: 'trace';
      time: number;
      midi: number | null;
      state: SampleState;
    }
  // End-of-song results card; null when the main window dismisses it.
  | {
      type: 'summary';
      summary: ScoreSummary | null;
    }
  // Sent by a stage window on startup to request an immediate state publish.
  | { type: 'hello' };

export function openStageChannel(): BroadcastChannel {
  return new BroadcastChannel(STAGE_CHANNEL);
}
