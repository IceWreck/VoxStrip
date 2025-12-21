package processor

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/IceWreck/VoxStrip/pkg/blobstore"
	"github.com/IceWreck/VoxStrip/pkg/config"
	"github.com/IceWreck/VoxStrip/pkg/store/inmemory"
)

func TestTaglibMetadataExtractor(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Create a temporary test file
	tempDir := t.TempDir()
	testFile := filepath.Join(tempDir, "test.mp3")

	// Create a minimal MP3 file for testing
	// For now, we'll just create an empty file to test the error handling
	file, err := os.Create(testFile)
	if err != nil {
		t.Fatalf("failed to create test file: %v", err)
	}
	file.Close()

	extractor := newTaglibMetadataExtractor()
	ctx := context.Background()

	// This will likely fail with an invalid MP3, but tests the integration
	metadata, duration, coverArt, err := extractor.extractMetadata(ctx, testFile)

	// We expect this to fail with an invalid file, but the function should not panic
	if err == nil {
		t.Logf("Unexpected success with invalid file: metadata=%v, duration=%d, coverArt_size=%d", metadata, duration, len(coverArt))
	}
}

func TestDemucsSeparator(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	separator := newDemucsSeparator("demucs", t.TempDir())
	ctx := context.Background()

	// Test with non-existent file
	_, _, err := separator.separateVocals(ctx, "test-song-id", "nonexistent.mp3")
	if err == nil {
		t.Error("expected error for non-existent file")
	}
}

func TestProcessorIntegration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Create in-memory store for testing
	store := inmemory.NewStore()

	// Create temporary blobstore
	tempDir := t.TempDir()
	blobStore, err := blobstore.NewFileSystemStore(tempDir)
	if err != nil {
		t.Fatalf("failed to create blobstore: %v", err)
	}

	// Create processor config
	audioConfig := config.AudioProcessingConfig{
		WorkerCount:       1,
		PollInterval:      100 * time.Millisecond,
		ProcessingTimeout: 1 * time.Second,
		DemucsCommand:     "demucs",
		TempDir:           t.TempDir(),
	}

	// Create processor
	fullConfig := config.Config{
		AudioProcessing: audioConfig,
	}
	processor := New(store, blobStore, fullConfig)

	// Test start/stop
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	go func() {
		time.Sleep(500 * time.Millisecond)
		processor.Stop()
	}()

	err = processor.Start(ctx)
	if err != nil {
		t.Errorf("processor start failed: %v", err)
	}
}
