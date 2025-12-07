package api

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"connectrpc.com/connect"
	voxstripv1 "github.com/IceWreck/VoxStrip/gen/proto"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/IceWreck/VoxStrip/pkg/store"
	"github.com/google/uuid"
)

// Service implements the KaraokeServiceHandler interface
type Service struct {
	store  store.Store
	config *config.Config
}

// NewService creates a new API service
func NewService(store store.Store, config *config.Config) *Service {
	return &Service{
		store:  store,
		config: config,
	}
}

// ImportSongs handles batch import of songs
func (s *Service) ImportSongs(ctx context.Context, req *connect.Request[voxstripv1.ImportSongsRequest]) (*connect.Response[voxstripv1.ImportSongsResponse], error) {
	slog.Info("importing songs", "count", len(req.Msg.Songs))

	results := make([]*voxstripv1.ImportSongResult, len(req.Msg.Songs))

	for i, importReq := range req.Msg.Songs {
		result := &voxstripv1.ImportSongResult{
			SongId: uuid.New().String(),
			Status: voxstripv1.ProcessingStatus_PROCESSING_STATUS_PENDING,
		}

		// Create song with PENDING status
		song := &store.Song{
			ID:               result.SongId,
			CreatedAt:        time.Now(),
			UpdatedAt:        time.Now(),
			ProcessingStatus: store.ProcessingStatusPending,
			ProcessingError:  "",
			// File paths will be set during actual processing
			// For now, we'll store audio data and set status to PENDING
		}

		// Extract metadata from overrides or use defaults
		if importReq.TitleOverride != nil {
			song.Metadata.Title = *importReq.TitleOverride
		}
		if importReq.ArtistOverride != nil {
			song.Metadata.Artist = *importReq.ArtistOverride
		}
		if importReq.AlbumOverride != nil {
			song.Metadata.Album = *importReq.AlbumOverride
		}
		if importReq.AlbumArtistOverride != nil {
			song.Metadata.AlbumArtist = *importReq.AlbumArtistOverride
		}
		if importReq.GenreOverride != nil {
			song.Metadata.Genre = *importReq.GenreOverride
		}
		if importReq.LyricsOverride != nil {
			song.Metadata.Lyrics = *importReq.LyricsOverride
		}

		// TODO: Save audio data to file system and update file paths
		// For now, we'll just create song record
		if err := s.store.CreateSong(ctx, song); err != nil {
			slog.Error("failed to create song", "id", result.SongId, "error", err)
			result.Status = voxstripv1.ProcessingStatus_PROCESSING_STATUS_FAILED
			result.ErrorMessage = fmt.Sprintf("failed to create song: %v", err)
		}

		results[i] = result
	}

	slog.Info("songs import completed", "total", len(results))
	return connect.NewResponse(&voxstripv1.ImportSongsResponse{
		Results: results,
	}), nil
}

// ListSongs handles paginated listing of songs
func (s *Service) ListSongs(ctx context.Context, req *connect.Request[voxstripv1.ListSongsRequest]) (*connect.Response[voxstripv1.ListSongsResponse], error) {
	slog.Debug("listing songs", "page_size", req.Msg.PageSize, "page_token", req.Msg.PageToken, "status_filter", req.Msg.StatusFilter)

	// Convert protobuf options to store options
	opts := store.ListOptions{
		PageSize:  int(req.Msg.PageSize),
		PageToken: req.Msg.PageToken,
	}

	if req.Msg.StatusFilter != nil {
		opts.StatusFilter = processingStatusFromProto(*req.Msg.StatusFilter)
	}

	songs, nextPageToken, total, err := s.store.ListSongs(ctx, opts)
	if err != nil {
		slog.Error("failed to list songs", "error", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to list songs: %w", err))
	}

	slog.Debug("songs listed", "count", len(songs), "total", total, "has_next", nextPageToken != "")
	return connect.NewResponse(&voxstripv1.ListSongsResponse{
		Songs:         songsToProto(songs),
		NextPageToken: nextPageToken,
		TotalSize:     int32(total),
	}), nil
}

// GetSong retrieves a single song by ID
func (s *Service) GetSong(ctx context.Context, req *connect.Request[voxstripv1.GetSongRequest]) (*connect.Response[voxstripv1.GetSongResponse], error) {
	slog.Debug("getting song", "id", req.Msg.SongId)

	song, err := s.store.GetSong(ctx, req.Msg.SongId)
	if err != nil {
		slog.Error("failed to get song", "id", req.Msg.SongId, "error", err)
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("song not found: %w", err))
	}

	slog.Debug("song retrieved", "id", song.ID)
	return connect.NewResponse(&voxstripv1.GetSongResponse{
		Song: songToProto(song),
	}), nil
}

// GetCoverArt retrieves cover art for a song
func (s *Service) GetCoverArt(ctx context.Context, req *connect.Request[voxstripv1.GetCoverArtRequest]) (*connect.Response[voxstripv1.GetCoverArtResponse], error) {
	slog.Debug("getting cover art", "id", req.Msg.SongId)

	song, err := s.store.GetSong(ctx, req.Msg.SongId)
	if err != nil {
		slog.Error("failed to get song for cover art", "id", req.Msg.SongId, "error", err)
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("song not found: %w", err))
	}

	if song.CoverArtPath == "" {
		slog.Debug("no cover art available", "id", req.Msg.SongId)
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("no cover art available for song"))
	}

	// TODO: Read cover art file from disk
	// For now, return empty response
	slog.Debug("cover art retrieved", "id", req.Msg.SongId, "path", song.CoverArtPath)
	return connect.NewResponse(&voxstripv1.GetCoverArtResponse{
		Image:    []byte{},    // TODO: Read actual image data
		Filename: "cover.jpg", // TODO: Extract from path
	}), nil
}

// DeleteSong removes a song from the library
func (s *Service) DeleteSong(ctx context.Context, req *connect.Request[voxstripv1.DeleteSongRequest]) (*connect.Response[voxstripv1.DeleteSongResponse], error) {
	slog.Info("deleting song", "id", req.Msg.SongId)

	if err := s.store.DeleteSong(ctx, req.Msg.SongId); err != nil {
		slog.Error("failed to delete song", "id", req.Msg.SongId, "error", err)
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("song not found: %w", err))
	}

	// TODO: Delete associated files from disk
	slog.Info("song deleted", "id", req.Msg.SongId)
	return connect.NewResponse(&voxstripv1.DeleteSongResponse{}), nil
}

// DownloadAudio handles audio download requests
func (s *Service) DownloadAudio(ctx context.Context, req *connect.Request[voxstripv1.DownloadAudioRequest]) (*connect.Response[voxstripv1.DownloadAudioResponse], error) {
	slog.Debug("downloading audio", "id", req.Msg.SongId, "version", req.Msg.Version, "format", req.Msg.OutputFormat)

	song, err := s.store.GetSong(ctx, req.Msg.SongId)
	if err != nil {
		slog.Error("failed to get song for download", "id", req.Msg.SongId, "error", err)
		return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("song not found: %w", err))
	}

	// Check if song processing is completed
	if song.ProcessingStatus != store.ProcessingStatusCompleted {
		slog.Debug("song not ready for download", "id", req.Msg.SongId, "status", song.ProcessingStatus)
		return nil, connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf("song not ready for download"))
	}

	// TODO: Implement actual audio file processing and download
	// For now, return empty response
	slog.Debug("audio download completed", "id", req.Msg.SongId)
	return connect.NewResponse(&voxstripv1.DownloadAudioResponse{
		Audio:    []byte{}, // TODO: Read actual audio data
		Filename: fmt.Sprintf("%s_%s.%s", song.Metadata.Title, req.Msg.Version, req.Msg.OutputFormat),
		Format:   req.Msg.OutputFormat,
	}), nil
}
