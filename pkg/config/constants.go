package config

const (
	// MaxAudioFileSize is the maximum allowed size for audio files (50MB)
	MaxAudioFileSize = 50 * 1024 * 1024

	// MaxCoverArtSize is the maximum allowed size for cover art images (10MB)
	MaxCoverArtSize = 10 * 1024 * 1024

	// MaxMetadataLength is the maximum allowed length for metadata string fields
	MaxMetadataLength = 500

	// MaxLyricsLength is the maximum allowed length for lyrics field
	MaxLyricsLength = 10000
)
