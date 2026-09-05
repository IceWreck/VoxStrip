package blobstore

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"sort"

	"github.com/gabriel-vasile/mimetype"
)

// MimeToExt maps supported MIME types to file extensions.
// Only these file types are supported - any other MIME type will cause Store to fail.
var MimeToExt = map[string]string{
	// audio (for songs)
	"audio/mpeg":      ".mp3",
	"audio/wav":       ".wav",
	"audio/x-wav":     ".wav",
	"audio/ogg":       ".ogg",
	"application/ogg": ".ogg",
	"audio/opus":      ".opus",
	"audio/flac":      ".flac",
	"audio/x-flac":    ".flac",
	"audio/aac":       ".aac",
	"audio/mp4":       ".m4a",
	"audio/x-m4a":     ".m4a",

	// image (for cover art)
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/gif":  ".gif",
	"image/webp": ".webp",

	// data (for pitch tracks)
	"application/json": ".json",
}

var ExtToMime = func() map[string]string {
	result := make(map[string]string)
	for mime, ext := range MimeToExt {
		result[ext] = mime
	}
	return result
}()

// sortedExts lists the known extensions in a stable order so blob lookups are
// deterministic (map iteration order is random).
var sortedExts = func() []string {
	exts := make([]string, 0, len(ExtToMime))
	for ext := range ExtToMime {
		exts = append(exts, ext)
	}
	sort.Strings(exts)
	return exts
}()

// ExtensionForMime returns the filename extension (without the dot) for a
// supported MIME type, defaulting to mp3 for unknown audio.
func ExtensionForMime(mimeType string) string {
	if ext, ok := MimeToExt[mimeType]; ok {
		return ext[1:]
	}
	return "mp3"
}

// detectContentTypeAndExtension sniffs the MIME type from the head of data.
// Returns the detected type, its extension, and a reader that replays the
// consumed header followed by the rest of the data.
func detectContentTypeAndExtension(data io.Reader) (string, string, io.Reader, error) {
	// mimetype reads up to 3072 bytes; buffer that much ourselves so the
	// consumed header can be replayed for the actual write.
	header := make([]byte, 3072)
	n, err := io.ReadFull(data, header)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return "", "", nil, fmt.Errorf("failed to read data for MIME detection: %w", err)
	}

	mimeType := mimetype.Detect(header[:n]).String()

	ext, exists := MimeToExt[mimeType]
	if !exists {
		return "", "", nil, fmt.Errorf("unsupported MIME type: %s", mimeType)
	}

	return mimeType, ext, io.MultiReader(bytes.NewReader(header[:n]), data), nil
}
