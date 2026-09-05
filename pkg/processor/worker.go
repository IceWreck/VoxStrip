package processor

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/IceWreck/VoxStrip/pkg/blobstore"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/IceWreck/VoxStrip/pkg/processor/pitch"
	"github.com/IceWreck/VoxStrip/pkg/store"
)

// worker represents a single audio processing worker
type worker struct {
	id        int
	store     store.Store
	blobStore blobstore.Store
	config    config.AudioProcessingConfig
}

// run starts the worker's main processing loop; it exits when ctx is
// cancelled.
func (w *worker) run(ctx context.Context) {
	slog.Info("starting audio worker", "worker_id", w.id)
	defer slog.Info("audio worker stopped", "worker_id", w.id)

	ticker := time.NewTicker(w.config.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := w.processNextSong(ctx); err != nil {
				slog.Error("error processing song", "worker_id", w.id, "error", err)
			}
		}
	}
}

// processNextSong finds and processes the next pending song
func (w *worker) processNextSong(ctx context.Context) error {
	// Atomically claim the next pending song
	song, err := w.store.ClaimNextPendingSong(ctx)
	if err != nil {
		return fmt.Errorf("failed to claim next pending song: %w", err)
	}

	if song == nil {
		// No pending songs
		return nil
	}

	slog.Info("processing song", "worker_id", w.id, "song_id", song.ID, "title", song.Metadata.Title)

	// Process with timeout
	processCtx, cancel := context.WithTimeout(ctx, w.config.ProcessingTimeout)
	defer cancel()

	if err := w.processSong(processCtx, song); err != nil {
		slog.Error("song processing failed", "worker_id", w.id, "song_id", song.ID, "error", err)

		if updateErr := w.finishProcessing(ctx, song, store.ProcessingStatusFailed, err.Error()); updateErr != nil {
			return fmt.Errorf("failed to mark song as failed: %w", updateErr)
		}
		return nil // Don't return error to continue processing other songs
	}

	if err := w.finishProcessing(ctx, song, store.ProcessingStatusCompleted, ""); err != nil {
		return fmt.Errorf("failed to mark song as completed: %w", err)
	}

	slog.Info("song processing completed", "worker_id", w.id, "song_id", song.ID)
	return nil
}

// finishProcessing writes the processing outcome onto a freshly loaded copy
// of the song rather than the claim-time copy, so metadata edits made while
// the song was processing are not overwritten. Tag-extracted metadata still
// fills fields that are empty in the fresh copy.
func (w *worker) finishProcessing(ctx context.Context, processed *store.Song, status store.ProcessingStatus, processingError string) error {
	fresh, err := w.store.GetSong(ctx, processed.ID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			// The song was deleted while processing; nothing to update.
			slog.Warn("song vanished during processing", "song_id", processed.ID)
			return nil
		}
		return fmt.Errorf("failed to reload song: %w", err)
	}

	fillEmptyMetadata(&fresh.Metadata, &processed.Metadata)
	fresh.DurationMs = processed.DurationMs
	fresh.ProcessingStatus = status
	fresh.ProcessingError = processingError
	fresh.UpdatedAt = time.Now().UTC()

	return w.store.UpdateSong(ctx, fresh)
}

// fillEmptyMetadata copies values from extracted into target for fields the
// target does not have yet.
func fillEmptyMetadata(target, extracted *store.Metadata) {
	if target.Title == "" {
		target.Title = extracted.Title
	}
	if target.Artist == "" {
		target.Artist = extracted.Artist
	}
	if target.Album == "" {
		target.Album = extracted.Album
	}
	if target.AlbumArtist == "" {
		target.AlbumArtist = extracted.AlbumArtist
	}
	if target.Genre == "" {
		target.Genre = extracted.Genre
	}
	if target.Lyrics == "" {
		target.Lyrics = extracted.Lyrics
	}
}

// processSong handles the complete processing pipeline for a song
func (w *worker) processSong(ctx context.Context, song *store.Song) error {
	// Download original audio file (creates temp file with correct extension)
	originalPath, _, err := w.downloadOriginalFile(ctx, song.ID)
	if err != nil {
		return fmt.Errorf("failed to download original file: %w", err)
	}
	defer os.Remove(originalPath) // Clean up temp file

	// Step 1: Extract metadata
	if err := w.extractAndUpdateMetadata(ctx, song, originalPath); err != nil {
		return fmt.Errorf("metadata extraction failed: %w", err)
	}

	// Step 2: Separate audio
	separator := newDemucsSeparator(w.config.TempDir, w.config.DemucsCommand, w.config.DemucsModel)
	vocalPath, instrumentalPath, err := separator.separateVocals(ctx, song.ID, originalPath)
	if err != nil {
		return fmt.Errorf("audio separation failed: %w", err)
	}

	// Clean up temporary stems on every exit path, including store failures.
	defer func() {
		if err := os.Remove(vocalPath); err != nil && !os.IsNotExist(err) {
			slog.Warn("failed to remove temporary vocal file", "file", vocalPath, "error", err)
		}
		if err := os.Remove(instrumentalPath); err != nil && !os.IsNotExist(err) {
			slog.Warn("failed to remove temporary instrumental file", "file", instrumentalPath, "error", err)
		}
	}()

	// Step 3: Write metadata to separated files
	if err := w.writeMetadataToSeparatedFiles(ctx, song, vocalPath, instrumentalPath); err != nil {
		slog.Warn("failed to write metadata to separated files", "song_id", song.ID, "error", err)
	}

	// Step 4: Store processed files
	if err := w.storeProcessedFile(ctx, song.ID, vocalPath, blobstore.FileTypeVocal); err != nil {
		return fmt.Errorf("failed to store vocal file: %w", err)
	}

	if err := w.storeProcessedFile(ctx, song.ID, instrumentalPath, blobstore.FileTypeInstrumental); err != nil {
		return fmt.Errorf("failed to store instrumental file: %w", err)
	}

	// Step 5: Extract the reference pitch track used for singing scoring.
	// Scoring is optional, so a failed extraction degrades the song instead
	// of failing it.
	if err := w.extractAndStorePitch(ctx, song.ID, vocalPath); err != nil {
		slog.Warn("failed to extract pitch track", "song_id", song.ID, "error", err)
	}

	return nil
}

// extractAndStorePitch computes the pitch track of the separated vocal stem
// and stores it as a JSON blob.
func (w *worker) extractAndStorePitch(ctx context.Context, songID, vocalPath string) error {
	file, err := os.Open(vocalPath)
	if err != nil {
		return err
	}
	defer file.Close()

	track, err := pitch.ExtractFromMP3(file)
	if err != nil {
		return err
	}

	data, err := track.Marshal()
	if err != nil {
		return err
	}

	if _, err := w.blobStore.Store(ctx, songID, blobstore.FileTypePitch, bytes.NewReader(data)); err != nil {
		return err
	}

	slog.Debug("pitch track stored", "song_id", songID, "notes", len(track.Notes))
	return nil
}

// writeMetadataToSeparatedFiles writes metadata and cover art to the separated audio files
func (w *worker) writeMetadataToSeparatedFiles(ctx context.Context, song *store.Song, vocalPath, instrumentalPath string) error {
	metadataExtractor := newTaglibMetadataExtractor()

	// Get cover art for metadata writing; a missing blob is fine.
	var coverArt []byte
	if reader, _, err := w.blobStore.Get(ctx, song.ID, blobstore.FileTypeCoverArt); err == nil {
		defer reader.Close()
		coverBytes := new(bytes.Buffer)
		if _, err := io.Copy(coverBytes, reader); err == nil {
			coverArt = coverBytes.Bytes()
		}
	}

	// Write metadata to vocal file
	if err := metadataExtractor.writeMetadata(ctx, vocalPath, &song.Metadata, coverArt, "vocals"); err != nil {
		slog.Warn("failed to write metadata to vocal file", "song_id", song.ID, "error", err)
	}

	// Write metadata to instrumental file
	if err := metadataExtractor.writeMetadata(ctx, instrumentalPath, &song.Metadata, coverArt, "instrumental"); err != nil {
		slog.Warn("failed to write metadata to instrumental file", "song_id", song.ID, "error", err)
	}

	return nil
}

// downloadOriginalFile downloads the original audio file from blobstore
func (w *worker) downloadOriginalFile(ctx context.Context, songID string) (string, *blobstore.BlobInfo, error) {
	reader, blobInfo, err := w.blobStore.Get(ctx, songID, blobstore.FileTypeOriginal)
	if err != nil {
		return "", nil, err
	}
	defer reader.Close()

	// Get file extension from MIME type
	ext, exists := blobstore.MimeToExt[blobInfo.ContentType]
	if !exists {
		return "", nil, fmt.Errorf("unsupported content type: %s", blobInfo.ContentType)
	}

	// Create temporary file with correct extension
	tempDir := w.config.TempDir
	if tempDir == "" {
		tempDir = os.TempDir()
	}

	// Ensure temp directory exists
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return "", nil, fmt.Errorf("failed to create temp directory: %w", err)
	}

	outputPath := filepath.Join(tempDir, fmt.Sprintf("original-%s%s", songID, ext))

	file, err := os.Create(outputPath)
	if err != nil {
		return "", nil, err
	}
	defer file.Close()

	_, err = io.Copy(file, reader)
	if err != nil {
		return "", nil, err
	}

	return outputPath, blobInfo, nil
}

// extractAndUpdateMetadata extracts metadata and cover art, updates the song if fields are empty
func (w *worker) extractAndUpdateMetadata(ctx context.Context, song *store.Song, audioPath string) error {
	metadataExtractor := newTaglibMetadataExtractor()
	metadata, duration, coverArt, err := metadataExtractor.extractMetadata(ctx, audioPath)
	if err != nil {
		return err
	}

	// Store cover art if it exists and no cover art is already stored
	if len(coverArt) > 0 {
		exists, err := w.blobStore.Exists(ctx, song.ID, blobstore.FileTypeCoverArt)
		if err != nil {
			slog.Error("failed to check cover art existence", "song_id", song.ID, "error", err)
		} else if !exists {
			if _, err := w.blobStore.Store(ctx, song.ID, blobstore.FileTypeCoverArt, bytes.NewReader(coverArt)); err != nil {
				slog.Error("failed to store extracted cover art", "song_id", song.ID, "error", err)
			} else {
				slog.Debug("extracted cover art stored", "song_id", song.ID, "size", len(coverArt))
			}
		}
	}

	// Update duration
	song.DurationMs = duration

	// Update metadata only if fields are empty (not overridden by user)
	if song.Metadata.Title == "" && metadata.Title != "" {
		song.Metadata.Title = metadata.Title
	}
	if song.Metadata.Artist == "" && metadata.Artist != "" {
		song.Metadata.Artist = metadata.Artist
	}
	if song.Metadata.Album == "" && metadata.Album != "" {
		song.Metadata.Album = metadata.Album
	}
	if song.Metadata.AlbumArtist == "" && metadata.AlbumArtist != "" {
		song.Metadata.AlbumArtist = metadata.AlbumArtist
	}
	if song.Metadata.Genre == "" && metadata.Genre != "" {
		song.Metadata.Genre = metadata.Genre
	}
	if song.Metadata.Lyrics == "" && metadata.Lyrics != "" {
		song.Metadata.Lyrics = metadata.Lyrics
	}

	return w.store.UpdateSong(ctx, song)
}

// storeProcessedFile stores a processed audio file in the blobstore
func (w *worker) storeProcessedFile(ctx context.Context, songID, filePath string, fileType blobstore.FileType) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = w.blobStore.Store(ctx, songID, fileType, file)
	return err
}
