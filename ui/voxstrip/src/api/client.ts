import { createConnectTransport } from '@connectrpc/connect-web';
import { createClient, ConnectError } from '@connectrpc/connect';
import { KaraokeService } from '../proto/server_pb.js';
import { API_CONFIG } from '../config.js';

// Create transport for Connect RPC
const transport = createConnectTransport({
  baseUrl: API_CONFIG.BASE_URL,
  fetch: (input, init) => {
    return fetch(input, {
      ...init,
      credentials: 'omit', // Omit credentials to avoid CORS issues with localhost
    });
  },
  interceptors: [
    (next) => async (req) => {
      // Add timeout to requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

      try {
        const response = await next({
          ...req,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
  ],
});

// Create client
export const karaokeClient = createClient(KaraokeService, transport);

// Helper functions for common operations
export class VoxStripAPI {
  /**
   * List songs with pagination and optional filtering
   */
  static async listSongs(options: {
    pageSize?: number;
    pageToken?: string;
    statusFilter?: import('../proto/server_pb.js').ProcessingStatus;
  } = {}) {
    const { pageSize, pageToken, statusFilter } = options;
    
    try {
      const response = await karaokeClient.listSongs({
        pageSize: pageSize || 20,
        pageToken: pageToken || '',
        statusFilter,
      });

      return response;
    } catch (error) {
      throw handleAPIError(error);
    }
  }

  /**
   * Get a specific song by ID
   */
  static async getSong(songId: string) {
    try {
      const response = await karaokeClient.getSong({
        songId,
      });

      return response.song;
    } catch (error) {
      throw handleAPIError(error);
    }
  }

  /**
   * Delete a song by ID
   */
  static async deleteSong(songId: string) {
    try {
      const response = await karaokeClient.deleteSong({
        songId,
      });

      return response;
    } catch (error) {
      throw handleAPIError(error);
    }
  }

  /**
   * Import songs (will be implemented later)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async importSongs(_songRequests: Array<{
    audio: File;
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    lyrics?: string;
  }>) {
    // TODO: Implement file upload logic
    // This will involve creating FormData and handling multipart uploads
    throw new Error('Import functionality not yet implemented');
  }

  /**
   * Download audio file for a specific song and version
   */
  static async downloadAudio(options: {
    songId: string;
    version: 'original' | 'vocal' | 'instrumental' | 'karaoke';
    format?: 'mp3' | 'wav';
    bitrate?: number;
  }) {
    const { songId, version, format = 'mp3', bitrate = 320 } = options;
    
    try {
      // Convert version string to protobuf enum
      const versionMap = {
        original: 1, // AUDIO_VERSION_ORIGINAL
        vocal: 2,    // AUDIO_VERSION_VOCAL  
        instrumental: 3, // AUDIO_VERSION_INSTRUMENTAL
        karaoke: 4,   // AUDIO_VERSION_KARAOKE
      } as const;
      
      // Convert format string to protobuf enum
      const formatMap = {
        mp3: 1, // AUDIO_FORMAT_MP3
        wav: 2, // AUDIO_FORMAT_WAV
      } as const;

      const response = await karaokeClient.downloadAudio({
        songId,
        version: versionMap[version],
        outputFormat: formatMap[format],
        bitrate,
      });

      return response;
    } catch (error) {
      throw handleAPIError(error);
    }
  }

  /**
   * Get cover art for a song
   */
  static async getCoverArt(songId: string) {
    try {
      const response = await karaokeClient.getCoverArt({
        songId,
      });
      return response;
    } catch (error) {
      throw handleAPIError(error);
    }
  }

  /**
   * Get cover art URL for a song (for legacy use with img tags)
   */
  static getCoverArtUrl(songId: string): string {
    return `${API_CONFIG.BASE_URL}/v1/songs/${songId}/cover-art`;
  }
}

// Export types for use in components
export type Song = import('../proto/server_pb.js').Song;
export type SongMetadata = import('../proto/server_pb.js').SongMetadata;
export type ProcessingStatus = import('../proto/server_pb.js').ProcessingStatus;

// Error handling utilities
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Helper to extract error information from API responses
export function handleAPIError(error: unknown): APIError {
  // Convert to ConnectError if it's not already one
  const connectError = ConnectError.from(error);
  
  if (connectError instanceof ConnectError) {
    return new APIError(
      connectError.rawMessage || connectError.message,
      connectError.code,
      connectError.code
    );
  }

  return new APIError('An unexpected error occurred');
}