package blobstore

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

// mimeToExt maps supported MIME types to file extensions.
// Only these file types are supported - any other MIME type will cause Store to fail.
var mimeToExt = map[string]string{
	// audio (for songs)
	"audio/mpeg":      ".mp3",
	"audio/wav":       ".wav",
	"audio/x-wav":     ".wav",
	"audio/ogg":       ".ogg",
	"application/ogg": ".ogg",
	"audio/opus":      ".opus",
	"audio/flac":      ".flac",
	"audio/aac":       ".aac",
	"audio/mp4":       ".m4a",

	// image (for cover art)
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

var extToMime = func() map[string]string {
	result := make(map[string]string)
	for mime, ext := range mimeToExt {
		result[ext] = mime
	}
	return result
}()

// detectContentTypeAndExtension analyzes the first 512 bytes of data to determine MIME type and file extension.
// Returns:
//   - mimeType: The detected MIME type (e.g., "audio/mpeg", "image/png")
//   - extension: The corresponding file extension (e.g., ".mp3", ".png")
//   - reader: A new io.Reader that includes the buffered data plus the remaining data
//   - error: Any error encountered during detection or if MIME type is unsupported
func detectContentTypeAndExtension(data io.Reader) (string, string, io.Reader, error) {
	buffer := make([]byte, 512)
	n, err := data.Read(buffer)
	if err != nil && err != io.EOF {
		return "", "", nil, fmt.Errorf("failed to read data for MIME detection: %w", err)
	}

	mimeType := http.DetectContentType(buffer[:n])

	ext, exists := mimeToExt[mimeType]
	if !exists {
		return "", "", nil, fmt.Errorf("unsupported MIME type: %s", mimeType)
	}

	return mimeType, ext, io.MultiReader(bytes.NewReader(buffer[:n]), data), nil
}
