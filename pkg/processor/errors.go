package processor

import "errors"

// Processor-specific errors
var (
	ErrProcessingTimeout    = errors.New("audio processing timeout")
	ErrDemucsFailed         = errors.New("demucs separation failed")
	ErrMetadataExtraction   = errors.New("metadata extraction failed")
	ErrFileNotFound         = errors.New("original audio file not found")
	ErrTempDirCreation      = errors.New("failed to create temporary directory")
	ErrFileDownload         = errors.New("failed to download original file")
	ErrProcessedFileStorage = errors.New("failed to store processed file")
)
