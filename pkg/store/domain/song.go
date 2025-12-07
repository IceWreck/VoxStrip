package domain

import (
	"time"
)

// ProcessingStatus represents the processing state of a song
type ProcessingStatus int32

const (
	ProcessingStatusUnspecified ProcessingStatus = 0
	ProcessingStatusPending     ProcessingStatus = 1
	ProcessingStatusProcessing  ProcessingStatus = 2
	ProcessingStatusCompleted   ProcessingStatus = 3
	ProcessingStatusFailed      ProcessingStatus = 4
)

// Metadata contains song information
type Metadata struct {
	Title       string
	Artist      string
	Album       string
	AlbumArtist string
	Genre       string
	Lyrics      string
}

// Song represents a song in the library
type Song struct {
	ID               string
	Metadata         Metadata
	CreatedAt        time.Time
	UpdatedAt        time.Time
	ProcessingStatus ProcessingStatus
	ProcessingError  string
	DurationMs       int64
}
