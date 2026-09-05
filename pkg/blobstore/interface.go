// Package blobstore provides storage abstraction for binary files associated with songs.
// Separates file storage from metadata store, enabling different storage backends.
//
// Each song ID can have multiple file types:
// - original: Uploaded audio files
// - vocal: Separated vocal tracks
// - instrumental: Separated instrumental tracks
// - cover_art: Album cover images
//
// FileSystemStore organizes files by type under base_path/{filetype}/{songID}.{ext}
// This allows independent scaling of metadata and file storage, and easy backend migration.

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
	FileTypePitch        FileType = "pitch"        // Reference pitch tracks (JSON)
)

// AllFileTypes lists every file type a song can have, for directory setup and
// whole-song deletion.
var AllFileTypes = []FileType{FileTypeOriginal, FileTypeVocal, FileTypeInstrumental, FileTypeCoverArt, FileTypePitch}

// BlobInfo contains metadata about a stored blob
type BlobInfo struct {
	Key          string    // Song ID
	Size         int64     // File size in bytes
	ContentType  string    // MIME type (TODO: infer from file name)
	LastModified time.Time // File modification time
}

// ErrNotFound is returned when a blob does not exist.
var ErrNotFound = errors.New("blob not found")

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
