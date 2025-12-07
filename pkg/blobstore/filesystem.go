package blobstore

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

// FileSystemStore implements the Store interface using local filesystem
type FileSystemStore struct {
	basePath string
}

// NewFileSystemStore creates a new filesystem-based blob store
func NewFileSystemStore(basePath string) (*FileSystemStore, error) {
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create base directory: %w", err)
	}

	// Create subdirectories for each file type
	for _, fileType := range []FileType{FileTypeOriginal, FileTypeVocal, FileTypeInstrumental, FileTypeCoverArt} {
		dir := filepath.Join(basePath, string(fileType))
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory for %s: %w", fileType, err)
		}
	}

	return &FileSystemStore{
		basePath: basePath,
	}, nil
}

// Store saves a blob with the given song ID and file type
func (fs *FileSystemStore) Store(ctx context.Context, songID string, fileType FileType, data io.Reader) (*BlobInfo, error) {
	// Create file path with empty extension for now
	// TODO: Infer extension from file name
	safeID := strings.ReplaceAll(songID, "..", "")
	safeID = filepath.Base(safeID)
	filePath := filepath.Join(fs.basePath, string(fileType), safeID)

	// Create the file
	file, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	// Copy data to file and track size
	size, err := io.Copy(file, data)
	if err != nil {
		os.Remove(filePath) // Clean up on error
		return nil, fmt.Errorf("failed to write data: %w", err)
	}

	// Get file info for modification time
	stat, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	blobInfo := &BlobInfo{
		Key:          songID,
		Size:         size,
		ContentType:  "", // TODO: infer from file name
		LastModified: stat.ModTime(),
	}

	slog.Debug("blob stored", "song_id", songID, "type", fileType, "size", size, "path", filePath)
	return blobInfo, nil
}

// Get retrieves a blob by song ID and file type
func (fs *FileSystemStore) Get(ctx context.Context, songID string, fileType FileType) (io.ReadCloser, *BlobInfo, error) {
	// Try file without extension first (current storage approach)
	safeID := strings.ReplaceAll(songID, "..", "")
	safeID = filepath.Base(safeID)
	filePath := filepath.Join(fs.basePath, string(fileType), safeID)

	stat, err := os.Stat(filePath)
	if err != nil {
		// TODO: Try different extensions when we implement extension inference
		return nil, nil, ErrNotFound
	}

	// Open file
	file, err := os.Open(filePath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open file: %w", err)
	}

	// TODO: Infer content type from file name when implemented
	blobInfo := &BlobInfo{
		Key:          songID,
		Size:         stat.Size(),
		ContentType:  "", // TODO: infer from file name
		LastModified: stat.ModTime(),
	}

	slog.Debug("blob retrieved", "song_id", songID, "type", fileType, "size", blobInfo.Size)
	return file, blobInfo, nil
}

// Delete removes all blobs associated with a song ID
func (fs *FileSystemStore) Delete(ctx context.Context, songID string) error {
	// Sanitize songID to prevent directory traversal
	safeID := strings.ReplaceAll(songID, "..", "")
	safeID = filepath.Base(safeID)

	var errors []error

	// Delete all files in all file type directories
	for _, fileType := range []FileType{FileTypeOriginal, FileTypeVocal, FileTypeInstrumental, FileTypeCoverArt} {
		dir := filepath.Join(fs.basePath, string(fileType))

		// Try to remove file without extension
		filePath := filepath.Join(dir, safeID)
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			errors = append(errors, fmt.Errorf("failed to delete %s file: %w", fileType, err))
		} else if err == nil {
			slog.Debug("blob deleted", "song_id", songID, "type", fileType, "path", filePath)
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("failed to delete some blobs: %v", errors)
	}

	slog.Debug("all blobs deleted for song", "song_id", songID)
	return nil
}

// Exists checks if a blob exists
func (fs *FileSystemStore) Exists(ctx context.Context, songID string, fileType FileType) (bool, error) {
	_, _, err := fs.Get(ctx, songID, fileType)
	if err != nil && err != ErrNotFound {
		return false, fmt.Errorf("failed to check file existence: %w", err)
	}

	return err != ErrNotFound, nil
}
