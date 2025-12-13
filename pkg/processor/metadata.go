package processor

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/IceWreck/VoxStrip/pkg/store"
	"go.senan.xyz/taglib"
)

// taglibMetadataExtractor implements MetadataExtractor using go-taglib
type taglibMetadataExtractor struct{}

// newTaglibMetadataExtractor creates a new taglib-based metadata extractor
func newTaglibMetadataExtractor() *taglibMetadataExtractor {
	return &taglibMetadataExtractor{}
}

// extractMetadata extracts metadata from an audio file using taglib
func (e *taglibMetadataExtractor) extractMetadata(ctx context.Context, audioPath string) (*store.Metadata, int64, error) {
	slog.Debug("extracting metadata", "file", audioPath)

	// Read tags
	tags, err := taglib.ReadTags(audioPath)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read audio tags: %w", err)
	}

	// Read properties (including duration)
	props, err := taglib.ReadProperties(audioPath)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read audio properties: %w", err)
	}

	// Helper function to get first value from tag map
	getFirst := func(key string) string {
		if values, exists := tags[key]; exists && len(values) > 0 {
			return values[0]
		}
		return ""
	}

	metadata := &store.Metadata{
		Title:       getFirst("TITLE"),
		Artist:      getFirst("ARTIST"),
		Album:       getFirst("ALBUM"),
		AlbumArtist: getFirst("ALBUMARTIST"),
		Genre:       getFirst("GENRE"),
		Lyrics:      getFirst("LYRICS"),
	}

	// Convert duration from seconds to milliseconds
	duration := int64(props.Length * 1000)

	slog.Debug("metadata extracted",
		"title", metadata.Title,
		"artist", metadata.Artist,
		"album", metadata.Album,
		"duration_ms", duration,
	)

	return metadata, duration, nil
}
