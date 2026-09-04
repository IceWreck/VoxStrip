// Cross-window messaging between the main app (which owns audio and controls)
// and read-only stage display windows, over a BroadcastChannel.

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
  // Sent by a stage window on startup to request an immediate state publish.
  | { type: 'hello' };

export function openStageChannel(): BroadcastChannel {
  return new BroadcastChannel(STAGE_CHANNEL);
}
