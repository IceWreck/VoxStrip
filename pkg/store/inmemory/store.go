package inmemory

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"time"

	"github.com/IceWreck/VoxStrip/pkg/store"
)

type inmemoryStore struct {
	mu    sync.RWMutex
	songs map[string]*store.Song
}

// NewStore creates a new in-memory store
func NewStore() store.Store {
	return &inmemoryStore{
		songs: make(map[string]*store.Song),
	}
}

// Close is a no-op for in-memory store
func (s *inmemoryStore) Close() error {
	slog.Debug("in-memory store closed")
	return nil
}

// CreateSong creates a new song in memory
func (s *inmemoryStore) CreateSong(ctx context.Context, song *store.Song) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.songs[song.ID]; exists {
		return fmt.Errorf("song with id %s already exists", song.ID)
	}

	// Create a copy to avoid external mutations
	songCopy := *song
	s.songs[song.ID] = &songCopy

	slog.Debug("song created in memory", "id", song.ID)
	return nil
}

// GetSong retrieves a song by ID from memory
func (s *inmemoryStore) GetSong(ctx context.Context, id string) (*store.Song, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	song, exists := s.songs[id]
	if !exists {
		return nil, fmt.Errorf("song with id %s not found", id)
	}

	// Return a copy to avoid external mutations
	songCopy := *song
	return &songCopy, nil
}

// ListSongs retrieves a paginated list of songs from memory
func (s *inmemoryStore) ListSongs(ctx context.Context, opts store.ListOptions) ([]*store.Song, string, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Filter songs by status if specified
	var filteredSongs []*store.Song
	for _, song := range s.songs {
		if opts.StatusFilter == store.ProcessingStatusUnspecified ||
			song.ProcessingStatus == opts.StatusFilter {
			songCopy := *song
			filteredSongs = append(filteredSongs, &songCopy)
		}
	}

	// Sort by created_at descending
	sort.Slice(filteredSongs, func(i, j int) bool {
		return filteredSongs[i].CreatedAt.After(filteredSongs[j].CreatedAt)
	})

	total := len(filteredSongs)

	// Apply pagination
	pageSize := opts.PageSize
	if pageSize <= 0 {
		pageSize = 50 // Default page size
	}

	start := 0
	if opts.PageToken != "" {
		// Find the starting position based on page token (timestamp)
		pageTime, err := time.Parse(time.RFC3339Nano, opts.PageToken)
		if err != nil {
			return nil, "", 0, fmt.Errorf("invalid page token: %w", err)
		}

		for i, song := range filteredSongs {
			if song.CreatedAt.Before(pageTime) || song.CreatedAt.Equal(pageTime) {
				start = i
				break
			}
		}
	}

	end := start + pageSize
	if end > len(filteredSongs) {
		end = len(filteredSongs)
	}

	if start >= len(filteredSongs) {
		return []*store.Song{}, "", total, nil
	}

	// Get the page
	var page []*store.Song
	for i := start; i < end; i++ {
		page = append(page, filteredSongs[i])
	}

	// Generate next page token
	var nextPageToken string
	if end < len(filteredSongs) {
		nextPageToken = filteredSongs[end-1].CreatedAt.Format(time.RFC3339Nano)
	}

	slog.Debug("listed songs from memory", "count", len(page), "total", total, "has_next", nextPageToken != "")
	return page, nextPageToken, total, nil
}

// UpdateSong updates an existing song in memory
func (s *inmemoryStore) UpdateSong(ctx context.Context, song *store.Song) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.songs[song.ID]; !exists {
		return fmt.Errorf("song with id %s not found", song.ID)
	}

	// Create a copy to avoid external mutations
	songCopy := *song
	songCopy.UpdatedAt = time.Now()
	s.songs[song.ID] = &songCopy

	slog.Debug("song updated in memory", "id", song.ID)
	return nil
}

// DeleteSong removes a song from memory
func (s *inmemoryStore) DeleteSong(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.songs[id]; !exists {
		return fmt.Errorf("song with id %s not found", id)
	}

	delete(s.songs, id)
	slog.Debug("song deleted from memory", "id", id)
	return nil
}
