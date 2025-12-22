package blobstore

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
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
	for _, fileType := range []FileType{FileTypeOriginal, FileTypeVocal, FileTypeInstrumental, FileTypeKaraoke, FileTypeCoverArt} {
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
	mimeType, ext, dataWithBuffer, err := detectContentTypeAndExtension(data)
	if err != nil {
		return nil, fmt.Errorf("failed to detect content type: %w", err)
	}

	filePath := filepath.Join(fs.basePath, string(fileType), songID+ext)

	file, err := os.Create(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	size, err := io.Copy(file, dataWithBuffer)
	if err != nil {
		os.Remove(filePath)
		return nil, fmt.Errorf("failed to write data: %w", err)
	}

	stat, err := file.Stat()
	if err != nil {
		return nil, fmt.Errorf("failed to get file info: %w", err)
	}

	blobInfo := &BlobInfo{
		Key:          songID,
		Size:         size,
		ContentType:  mimeType,
		LastModified: stat.ModTime(),
	}

	slog.Debug("blob stored", "song_id", songID, "type", fileType, "size", size, "path", filePath, "mime_type", mimeType)
	return blobInfo, nil
}

// Get retrieves a blob by song ID and file type
func (fs *FileSystemStore) Get(ctx context.Context, songID string, fileType FileType) (io.ReadCloser, *BlobInfo, error) {
	dir := filepath.Join(fs.basePath, string(fileType))

	for ext, mimeType := range ExtToMime {
		filePath := filepath.Join(dir, songID+ext)
		if stat, err := os.Stat(filePath); err == nil {
			file, err := os.Open(filePath)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to open file: %w", err)
			}

			blobInfo := &BlobInfo{
				Key:          songID,
				Size:         stat.Size(),
				ContentType:  mimeType,
				LastModified: stat.ModTime(),
			}

			slog.Debug("blob retrieved", "song_id", songID, "type", fileType, "size", blobInfo.Size, "mime_type", mimeType)
			return file, blobInfo, nil
		}
	}

	return nil, nil, ErrNotFound
}

// Delete removes all blobs associated with a song ID
func (fs *FileSystemStore) Delete(ctx context.Context, songID string) error {
	var errors []error

	for _, fileType := range []FileType{FileTypeOriginal, FileTypeVocal, FileTypeInstrumental, FileTypeKaraoke, FileTypeCoverArt} {
		dir := filepath.Join(fs.basePath, string(fileType))

		pattern := filepath.Join(dir, songID+"*")
		matches, err := filepath.Glob(pattern)
		if err != nil {
			errors = append(errors, fmt.Errorf("failed to glob pattern for %s: %w", fileType, err))
			continue
		}

		for _, match := range matches {
			if err := os.Remove(match); err != nil && !os.IsNotExist(err) {
				errors = append(errors, fmt.Errorf("failed to delete %s file %s: %w", fileType, match, err))
			} else if err == nil {
				slog.Debug("blob deleted", "song_id", songID, "type", fileType, "path", match)
			}
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
