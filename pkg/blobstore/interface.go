package blobstore

import (
	"context"
	"errors"
	"io"
	"time"
)

// FileType represents different types of files stored in the blobstore
type FileType string

const (
	FileTypeOriginal     FileType = "original"     // Uploaded audio files
	FileTypeVocal        FileType = "vocal"        // Separated vocals
	FileTypeInstrumental FileType = "instrumental" // Separated instruments
	FileTypeCoverArt     FileType = "cover_art"    // Cover art images
)

// BlobInfo contains metadata about a stored blob
type BlobInfo struct {
	Key          string    // Song ID
	Size         int64     // File size in bytes
	ContentType  string    // MIME type (TODO: infer from file name)
	LastModified time.Time // File modification time
}

// Common errors
var (
	ErrNotFound = errors.New("blob not found")
	ErrExists   = errors.New("blob already exists")
)

// Store defines the interface for blob storage operations
type Store interface {
	// Store saves a blob with the given song ID and file type
	Store(ctx context.Context, songID string, fileType FileType, data io.Reader) (*BlobInfo, error)

	// Get retrieves a blob by song ID and file type
	Get(ctx context.Context, songID string, fileType FileType) (io.ReadCloser, *BlobInfo, error)

	// Delete removes all blobs associated with a song ID
	Delete(ctx context.Context, songID string) error

	// Exists checks if a blob exists
	Exists(ctx context.Context, songID string, fileType FileType) (bool, error)
}
