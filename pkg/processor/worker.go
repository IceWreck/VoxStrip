package processor

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/IceWreck/VoxStrip/pkg/blobstore"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/IceWreck/VoxStrip/pkg/store"
)

// worker represents a single audio processing worker
type worker struct {
	id        int
	store     store.Store
	blobStore blobstore.Store
	config    config.AudioProcessingConfig
	stopCh    chan struct{}
	running   bool
}

// run starts the worker's main processing loop
func (w *worker) run(ctx context.Context) {
	slog.Info("starting audio worker", "worker_id", w.id)
	w.running = true
	defer func() {
		w.running = false
		slog.Info("audio worker stopped", "worker_id", w.id)
	}()

	ticker := time.NewTicker(w.config.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-w.stopCh:
			return
		case <-ticker.C:
			if err := w.processNextSong(ctx); err != nil {
				slog.Error("error processing song", "worker_id", w.id, "error", err)
			}
		}
	}
}

// wait blocks until the worker is stopped
func (w *worker) wait() {
	for w.running {
		time.Sleep(100 * time.Millisecond)
	}
}

// processNextSong finds and processes the next pending song
func (w *worker) processNextSong(ctx context.Context) error {
	// Get next pending song
	songs, _, _, err := w.store.ListSongs(ctx, store.ListOptions{
		PageSize:     1,
		StatusFilter: store.ProcessingStatusPending,
	})
	if err != nil {
		return fmt.Errorf("failed to list pending songs: %w", err)
	}

	if len(songs) == 0 {
		// No pending songs
		return nil
	}

	song := songs[0]
	slog.Info("processing song", "worker_id", w.id, "song_id", song.ID, "title", song.Metadata.Title)

	// Mark as processing
	song.ProcessingStatus = store.ProcessingStatusProcessing
	song.UpdatedAt = time.Now()
	if err := w.store.UpdateSong(ctx, song); err != nil {
		return fmt.Errorf("failed to mark song as processing: %w", err)
	}

	// Process with timeout
	processCtx, cancel := context.WithTimeout(ctx, w.config.ProcessingTimeout)
	defer cancel()

	if err := w.processSong(processCtx, song); err != nil {
		slog.Error("song processing failed", "worker_id", w.id, "song_id", song.ID, "error", err)

		// Mark as failed
		song.ProcessingStatus = store.ProcessingStatusFailed
		song.ProcessingError = err.Error()
		song.UpdatedAt = time.Now()
		if updateErr := w.store.UpdateSong(ctx, song); updateErr != nil {
			return fmt.Errorf("failed to mark song as failed: %w", updateErr)
		}
		return nil // Don't return error to continue processing other songs
	}

	// Mark as completed
	song.ProcessingStatus = store.ProcessingStatusCompleted
	song.ProcessingError = ""
	song.UpdatedAt = time.Now()
	if err := w.store.UpdateSong(ctx, song); err != nil {
		return fmt.Errorf("failed to mark song as completed: %w", err)
	}

	slog.Info("song processing completed", "worker_id", w.id, "song_id", song.ID)
	return nil
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
	metadataExtractor := NewTaglibMetadataExtractor()
	if err := w.extractAndUpdateMetadata(ctx, song, originalPath, metadataExtractor); err != nil {
		return fmt.Errorf("metadata extraction failed: %w", err)
	}

	// Step 2: Separate audio
	separator := NewDemucsSeparator(w.config.TempDir, w.config.DemucsCommand)
	vocalPath, instrumentalPath, err := separator.SeparateVocals(ctx, originalPath)
	if err != nil {
		return fmt.Errorf("audio separation failed: %w", err)
	}

	// Store processed files
	if err := w.storeProcessedFile(ctx, song.ID, vocalPath, blobstore.FileTypeVocal); err != nil {
		return fmt.Errorf("failed to store vocal file: %w", err)
	}

	if err := w.storeProcessedFile(ctx, song.ID, instrumentalPath, blobstore.FileTypeInstrumental); err != nil {
		return fmt.Errorf("failed to store instrumental file: %w", err)
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

// extractAndUpdateMetadata extracts metadata and updates the song if fields are empty
func (w *worker) extractAndUpdateMetadata(ctx context.Context, song *store.Song, audioPath string, metadataExtractor MetadataExtractor) error {
	metadata, duration, err := metadataExtractor.ExtractMetadata(ctx, audioPath)
	if err != nil {
		return err
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
