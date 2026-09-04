package store

import (
	"context"
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

// ListOptions contains options for listing songs
type ListOptions struct {
	PageSize     int
	PageToken    string
	StatusFilter ProcessingStatus
}

// Store defines the interface for song storage operations
type Store interface {
	// CreateSong creates a new song in the store
	CreateSong(ctx context.Context, song *Song) error

	// GetSong retrieves a song by ID
	GetSong(ctx context.Context, id string) (*Song, error)

	// ListSongs retrieves a paginated list of songs
	// Returns the songs, next page token, and total count
	ListSongs(ctx context.Context, opts ListOptions) ([]*Song, string, int, error)

	// UpdateSong updates an existing song
	UpdateSong(ctx context.Context, song *Song) error

	// DeleteSong removes a song from the store
	DeleteSong(ctx context.Context, id string) error

	// ClaimNextPendingSong atomically claims the next pending song for processing
	// Returns nil if no pending songs are available
	ClaimNextPendingSong(ctx context.Context) (*Song, error)

	// RequeueProcessingSongs resets songs stuck in the processing state back
	// to pending, returning how many were reset. Called on startup so songs
	// orphaned by a crash or restart get picked up again.
	RequeueProcessingSongs(ctx context.Context) (int, error)

	// Close closes the store and releases resources
	Close() error
}
