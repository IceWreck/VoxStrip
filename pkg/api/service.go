package api

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"connectrpc.com/connect"
	voxstripv1 "github.com/IceWreck/VoxStrip/gen/proto"
	"github.com/IceWreck/VoxStrip/pkg/blobstore"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/IceWreck/VoxStrip/pkg/store"
	"github.com/google/uuid"
)

// Service implements the KaraokeServiceHandler interface
type Service struct {
	store     store.Store
	config    *config.Config
	blobstore blobstore.Store
}

// NewService creates a new API service
func NewService(store store.Store, config *config.Config, blobstore blobstore.Store) *Service {
	return &Service{
		store:     store,
		config:    config,
		blobstore: blobstore,
	}
}

// validateImportSongRequest validates a single import song request
func (s *Service) validateImportSongRequest(req *voxstripv1.ImportSongRequest) error {
	// Validate audio file size
	if len(req.Audio) == 0 {
		return fmt.Errorf("audio data is required")
	}
	if len(req.Audio) > config.MaxAudioFileSize {
		return fmt.Errorf("audio file size exceeds maximum allowed size of %d bytes", config.MaxAudioFileSize)
	}

	// Validate cover art size if provided
	if req.CoverArtOverride != nil {
		if len(req.CoverArtOverride) > config.MaxCoverArtSize {
			return fmt.Errorf("cover art size exceeds maximum allowed size of %d bytes", config.MaxCoverArtSize)
		}
	}

	// Validate metadata field lengths
	if req.TitleOverride != nil && len(*req.TitleOverride) > config.MaxMetadataLength {
		return fmt.Errorf("title exceeds maximum length of %d characters", config.MaxMetadataLength)
	}
	if req.ArtistOverride != nil && len(*req.ArtistOverride) > config.MaxMetadataLength {
		return fmt.Errorf("artist exceeds maximum length of %d characters", config.MaxMetadataLength)
	}
	if req.AlbumOverride != nil && len(*req.AlbumOverride) > config.MaxMetadataLength {
		return fmt.Errorf("album exceeds maximum length of %d characters", config.MaxMetadataLength)
	}
	if req.AlbumArtistOverride != nil && len(*req.AlbumArtistOverride) > config.MaxMetadataLength {
		return fmt.Errorf("album artist exceeds maximum length of %d characters", config.MaxMetadataLength)
	}
	if req.GenreOverride != nil && len(*req.GenreOverride) > config.MaxMetadataLength {
		return fmt.Errorf("genre exceeds maximum length of %d characters", config.MaxMetadataLength)
	}
	if req.LyricsOverride != nil && len(*req.LyricsOverride) > config.MaxLyricsLength {
		return fmt.Errorf("lyrics exceed maximum length of %d characters", config.MaxLyricsLength)
	}

	return nil
}

// songError maps store errors onto connect codes so a missing song is a
// not-found while a genuine store failure surfaces as an internal error.
func songError(err error) *connect.Error {
	if errors.Is(err, store.ErrNotFound) {
		return connect.NewError(connect.CodeNotFound, err)
	}
	return connect.NewError(connect.CodeInternal, fmt.Errorf("store failure: %w", err))
}

// validateSongID validates that a song ID is a proper UUID format
func (s *Service) validateSongID(songID string) error {
	if songID == "" {
		return fmt.Errorf("song ID cannot be empty")
	}

	// Validate UUID format
	if _, err := uuid.Parse(songID); err != nil {
		return fmt.Errorf("invalid song ID format: must be a valid UUID")
	}

	return nil
}

// ImportSongs handles batch import of songs
func (s *Service) ImportSongs(ctx context.Context, req *connect.Request[voxstripv1.ImportSongsRequest]) (*connect.Response[voxstripv1.ImportSongsResponse], error) {
	slog.Info("importing songs", "count", len(req.Msg.Songs))

	// Validate request batch size
	if len(req.Msg.Songs) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("at least one song must be provided"))
	}
	if len(req.Msg.Songs) > 100 {
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("maximum 100 songs can be imported in a single request"))
	}

	results := make([]*voxstripv1.ImportSongResult, len(req.Msg.Songs))

	for i, importReq := range req.Msg.Songs {
		// Validate the import request
		if err := s.validateImportSongRequest(importReq); err != nil {
			slog.Error("validation failed", "index", i, "error", err)
			results[i] = &voxstripv1.ImportSongResult{
				Status:       voxstripv1.ProcessingStatus_PROCESSING_STATUS_FAILED,
				ErrorMessage: fmt.Sprintf("validation failed: %v", err),
			}
			continue
		}
		result := &voxstripv1.ImportSongResult{
			SongId: uuid.New().String(),
			Status: voxstripv1.ProcessingStatus_PROCESSING_STATUS_PENDING,
		}

		// Create song with PENDING status
		now := time.Now().UTC()
		song := &store.Song{
			ID:               result.SongId,
			CreatedAt:        now,
			UpdatedAt:        now,
			ProcessingStatus: store.ProcessingStatusPending,
			ProcessingError:  "",
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

		// Store audio data in blobstore - this must succeed before creating
		// the database entry. Empty audio was already rejected by validation.
		if _, err := s.blobstore.Store(ctx, result.SongId, blobstore.FileTypeOriginal, bytes.NewReader(importReq.Audio)); err != nil {
			slog.Error("failed to store audio data", "id", result.SongId, "error", err)
			result.Status = voxstripv1.ProcessingStatus_PROCESSING_STATUS_FAILED
			result.ErrorMessage = fmt.Sprintf("failed to store audio data: %v", err)
			results[i] = result
			continue // Skip database entry if file storage fails
		}

		// Store cover art override if provided (non-critical)
		if importReq.CoverArtOverride != nil {
			if _, err := s.blobstore.Store(ctx, result.SongId, blobstore.FileTypeCoverArt, bytes.NewReader(importReq.CoverArtOverride)); err != nil {
				slog.Error("failed to store cover art", "id", result.SongId, "error", err)
				// Don't fail import, just log error
			} else {
				slog.Debug("cover art override stored", "id", result.SongId, "size", len(importReq.CoverArtOverride))
			}
		}

		// Only create database entry after successful file storage
		if err := s.store.CreateSong(ctx, song); err != nil {
			slog.Error("failed to create song", "id", result.SongId, "error", err)
			result.Status = voxstripv1.ProcessingStatus_PROCESSING_STATUS_FAILED
			result.ErrorMessage = fmt.Sprintf("failed to create song: %v", err)

			// Remove the stored blobs so a failed import leaves no orphans
			if err := s.blobstore.Delete(ctx, result.SongId); err != nil {
				slog.Warn("failed to clean up blobs for failed import", "id", result.SongId, "error", err)
			}
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

	// Validate song ID format
	if err := s.validateSongID(req.Msg.SongId); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	song, err := s.store.GetSong(ctx, req.Msg.SongId)
	if err != nil {
		slog.Error("failed to get song", "id", req.Msg.SongId, "error", err)
		return nil, songError(err)
	}

	slog.Debug("song retrieved", "id", song.ID)
	return connect.NewResponse(&voxstripv1.GetSongResponse{
		Song: songToProto(song),
	}), nil
}

// validateMetadataUpdates validates field lengths on an update request.
func validateMetadataUpdates(req *voxstripv1.UpdateSongRequest) error {
	fields := map[string]*string{
		"title":        req.Title,
		"artist":       req.Artist,
		"album":        req.Album,
		"album artist": req.AlbumArtist,
		"genre":        req.Genre,
	}
	for name, value := range fields {
		if value != nil && len(*value) > config.MaxMetadataLength {
			return fmt.Errorf("%s exceeds maximum length of %d characters", name, config.MaxMetadataLength)
		}
	}
	if req.Lyrics != nil && len(*req.Lyrics) > config.MaxLyricsLength {
		return fmt.Errorf("lyrics exceed maximum length of %d characters", config.MaxLyricsLength)
	}
	return nil
}

// applyMetadataUpdates copies set fields from an update request onto metadata.
func applyMetadataUpdates(metadata *store.Metadata, req *voxstripv1.UpdateSongRequest) {
	if req.Title != nil {
		metadata.Title = *req.Title
	}
	if req.Artist != nil {
		metadata.Artist = *req.Artist
	}
	if req.Album != nil {
		metadata.Album = *req.Album
	}
	if req.AlbumArtist != nil {
		metadata.AlbumArtist = *req.AlbumArtist
	}
	if req.Genre != nil {
		metadata.Genre = *req.Genre
	}
	if req.Lyrics != nil {
		metadata.Lyrics = *req.Lyrics
	}
}

// UpdateSong updates metadata for an existing song. Only fields present in the
// request are changed; everything else keeps its current value.
func (s *Service) UpdateSong(ctx context.Context, req *connect.Request[voxstripv1.UpdateSongRequest]) (*connect.Response[voxstripv1.UpdateSongResponse], error) {
	slog.Info("updating song", "id", req.Msg.SongId)

	if err := s.validateSongID(req.Msg.SongId); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}
	if err := validateMetadataUpdates(req.Msg); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	song, err := s.store.GetSong(ctx, req.Msg.SongId)
	if err != nil {
		slog.Error("failed to get song for update", "id", req.Msg.SongId, "error", err)
		return nil, songError(err)
	}

	applyMetadataUpdates(&song.Metadata, req.Msg)
	song.UpdatedAt = time.Now()

	if err := s.store.UpdateSong(ctx, song); err != nil {
		slog.Error("failed to update song", "id", req.Msg.SongId, "error", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to update song: %w", err))
	}

	slog.Info("song updated", "id", song.ID)
	return connect.NewResponse(&voxstripv1.UpdateSongResponse{
		Song: songToProto(song),
	}), nil
}

// GetCoverArt retrieves cover art for a song
func (s *Service) GetCoverArt(ctx context.Context, req *connect.Request[voxstripv1.GetCoverArtRequest]) (*connect.Response[voxstripv1.GetCoverArtResponse], error) {
	slog.Debug("getting cover art", "id", req.Msg.SongId)

	// Validate song ID format
	if err := s.validateSongID(req.Msg.SongId); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	// Verify song exists
	_, err := s.store.GetSong(ctx, req.Msg.SongId)
	if err != nil {
		slog.Error("failed to get song for cover art", "id", req.Msg.SongId, "error", err)
		return nil, songError(err)
	}

	// Read cover art from blobstore
	reader, blobInfo, err := s.blobstore.Get(ctx, req.Msg.SongId, blobstore.FileTypeCoverArt)
	if err != nil {
		if errors.Is(err, blobstore.ErrNotFound) {
			slog.Debug("no cover art available", "id", req.Msg.SongId)
			return nil, connect.NewError(connect.CodeNotFound, fmt.Errorf("no cover art available for song"))
		}
		slog.Error("failed to get cover art from blobstore", "id", req.Msg.SongId, "error", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to retrieve cover art: %w", err))
	}
	defer reader.Close()

	// Read all data into memory
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(reader); err != nil {
		slog.Error("failed to read cover art data", "id", req.Msg.SongId, "error", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to read cover art data: %w", err))
	}

	filename := "cover." + blobstore.ExtensionForMime(blobInfo.ContentType)

	slog.Debug("cover art retrieved", "id", req.Msg.SongId, "size", blobInfo.Size)
	return connect.NewResponse(&voxstripv1.GetCoverArtResponse{
		Image:    buf.Bytes(),
		Filename: filename,
	}), nil
}

// DeleteSong removes a song from the library
func (s *Service) DeleteSong(ctx context.Context, req *connect.Request[voxstripv1.DeleteSongRequest]) (*connect.Response[voxstripv1.DeleteSongResponse], error) {
	slog.Info("deleting song", "id", req.Msg.SongId)

	// Validate song ID format
	if err := s.validateSongID(req.Msg.SongId); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	if err := s.store.DeleteSong(ctx, req.Msg.SongId); err != nil {
		slog.Error("failed to delete song", "id", req.Msg.SongId, "error", err)
		return nil, songError(err)
	}

	// Delete associated files from blobstore
	if err := s.blobstore.Delete(ctx, req.Msg.SongId); err != nil {
		slog.Warn("failed to delete blob files", "id", req.Msg.SongId, "error", err)
		// Don't fail the operation if blob deletion fails
	}

	slog.Info("song deleted", "id", req.Msg.SongId)
	return connect.NewResponse(&voxstripv1.DeleteSongResponse{}), nil
}

// DownloadAudio handles audio download requests
func (s *Service) DownloadAudio(ctx context.Context, req *connect.Request[voxstripv1.DownloadAudioRequest]) (*connect.Response[voxstripv1.DownloadAudioResponse], error) {
	slog.Debug("downloading audio", "id", req.Msg.SongId, "version", req.Msg.Version)

	// Validate song ID format
	if err := s.validateSongID(req.Msg.SongId); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	song, err := s.store.GetSong(ctx, req.Msg.SongId)
	if err != nil {
		slog.Error("failed to get song for download", "id", req.Msg.SongId, "error", err)
		return nil, songError(err)
	}

	// Check if song processing is completed
	if song.ProcessingStatus != store.ProcessingStatusCompleted {
		slog.Debug("song not ready for download", "id", req.Msg.SongId, "status", song.ProcessingStatus)
		return nil, connect.NewError(connect.CodeFailedPrecondition, fmt.Errorf("song not ready for download"))
	}

	// Determine which file type to retrieve based on version
	var fileType blobstore.FileType
	switch req.Msg.Version {
	case voxstripv1.AudioVersion_AUDIO_VERSION_ORIGINAL:
		fileType = blobstore.FileTypeOriginal
	case voxstripv1.AudioVersion_AUDIO_VERSION_VOCAL:
		fileType = blobstore.FileTypeVocal
	case voxstripv1.AudioVersion_AUDIO_VERSION_INSTRUMENTAL:
		fileType = blobstore.FileTypeInstrumental
	default:
		return nil, connect.NewError(connect.CodeInvalidArgument, fmt.Errorf("invalid audio version"))
	}

	// Get audio file from blobstore
	reader, blobInfo, err := s.blobstore.Get(ctx, req.Msg.SongId, fileType)
	if err != nil {
		slog.Error("failed to get audio from blobstore", "id", req.Msg.SongId, "version", req.Msg.Version, "error", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to retrieve audio: %w", err))
	}
	defer reader.Close()

	// Read all data into memory
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(reader); err != nil {
		slog.Error("failed to read audio data", "id", req.Msg.SongId, "error", err)
		return nil, connect.NewError(connect.CodeInternal, fmt.Errorf("failed to read audio data: %w", err))
	}

	versionName := strings.ToLower(strings.TrimPrefix(req.Msg.Version.String(), "AUDIO_VERSION_"))
	filename := fmt.Sprintf("%s_%s.%s", song.Metadata.Title, versionName, blobstore.ExtensionForMime(blobInfo.ContentType))

	slog.Debug("audio download completed", "id", req.Msg.SongId, "version", req.Msg.Version, "size", blobInfo.Size)
	return connect.NewResponse(&voxstripv1.DownloadAudioResponse{
		Audio:    buf.Bytes(),
		Filename: filename,
	}), nil
}
