import { createConnectTransport } from '@connectrpc/connect-web';
import { createClient } from '@connectrpc/connect';
import { KaraokeService } from '../proto/server_pb.js';
import { API_CONFIG } from '../config.js';

// Create transport for Connect RPC
const transport = createConnectTransport({
  baseUrl: `${API_CONFIG.BASE_URL}`,
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
    
    const response = await karaokeClient.listSongs({
      pageSize: pageSize || 20,
      pageToken: pageToken || '',
      statusFilter,
    });

    return response;
  }

  /**
   * Get a specific song by ID
   */
  static async getSong(songId: string) {
    const response = await karaokeClient.getSong({
      songId,
    });

    return response.song;
  }

  /**
   * Delete a song by ID
   */
  static async deleteSong(songId: string) {
    const response = await karaokeClient.deleteSong({
      songId,
    });

    return response;
  }

  /**
   * Import songs (will be implemented later)
   */
  static async importSongs(songRequests: Array<{
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
  static getDownloadUrl(songId: string, version: 'original' | 'vocal' | 'instrumental' | 'karaoke'): string {
    // Construct download URL based on API specification
    const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, ''); // Remove trailing slash
    return `${baseUrl}/v1/songs/${songId}/audio/${version}`;
  }

  /**
   * Get cover art URL for a song
   */
  static getCoverArtUrl(songId: string): string {
    const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, '');
    return `${baseUrl}/v1/songs/${songId}/cover-art`;
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
  if (error instanceof APIError) {
    return error;
  }

  if (error instanceof Error) {
    // Try to extract more detailed error information if available
    if ('message' in error) {
      return new APIError(error.message);
    }
  }

  return new APIError('An unexpected error occurred');
}
