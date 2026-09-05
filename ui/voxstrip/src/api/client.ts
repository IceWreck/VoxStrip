// The single seam between the UI and the backend. Everything the app knows
// about ConnectRPC, media URLs, and proto serialization lives here; the rest
// of the code deals in Song objects and plain functions.

import { createConnectTransport } from '@connectrpc/connect-web';
import { createClient, ConnectError } from '@connectrpc/connect';
import { fromJson, toJson, type JsonValue } from '@bufbuild/protobuf';
import { KaraokeService, SongSchema } from '../proto/server_pb';
import type { Song } from '../proto/server_pb';

export type { Song } from '../proto/server_pb';
export { ProcessingStatus } from '../proto/server_pb';

// Empty means same-origin; the dev server sets VITE_API_BASE_URL instead.
export const API_BASE: string = import.meta.env.VITE_API_BASE_URL || '';

const transport = createConnectTransport({
  baseUrl: API_BASE,
  defaultTimeoutMs: 30_000,
  fetch: (input, init) => fetch(input, { ...init, credentials: 'include' }),
});

// api is the typed ConnectRPC client for all KaraokeService methods.
export const api = createClient(KaraokeService, transport);

// Audio version names as used by the GET /media routes.
export type AudioVersionName = 'original' | 'vocal' | 'instrumental';

// mediaUrl builds plain GET URLs for streaming audio and cacheable cover art.
export const mediaUrl = {
  cover: (songId: string) => `${API_BASE}/media/${songId}/cover`,
  audio: (songId: string, version: AudioVersionName) => `${API_BASE}/media/${songId}/audio/${version}`,
  pitch: (songId: string) => `${API_BASE}/media/${songId}/pitch`,
};

// songToJSON/songFromJSON convert songs for localStorage persistence and
// BroadcastChannel transfer, where proto messages (bigint fields) can't be
// used directly.
export function songToJSON(song: Song): JsonValue {
  return toJson(SongSchema, song);
}

export function songFromJSON(json: JsonValue): Song | null {
  try {
    return fromJson(SongSchema, json);
  } catch {
    return null;
  }
}

// errorMessage extracts a human-readable message from any thrown API error.
export function errorMessage(error: unknown): string {
  if (error instanceof ConnectError) return error.rawMessage || error.message;
  if (error instanceof Error) return error.message;
  return 'unexpected error';
}
