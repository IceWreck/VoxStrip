package sqlite

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/IceWreck/VoxStrip/pkg/store"
)

func newTestStore(t *testing.T) store.Store {
	t.Helper()
	s, err := NewStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func testSong(id string, createdAt time.Time, status store.ProcessingStatus) *store.Song {
	return &store.Song{
		ID:               id,
		Metadata:         store.Metadata{Title: "title-" + id, Artist: "artist"},
		CreatedAt:        createdAt,
		UpdatedAt:        createdAt,
		ProcessingStatus: status,
	}
}

func TestCRUDRoundTrip(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	now := time.Now().UTC()

	song := testSong("song-1", now, store.ProcessingStatusPending)
	song.Metadata.Lyrics = "[00:01.00]hello"
	song.DurationMs = 207853

	if err := s.CreateSong(ctx, song); err != nil {
		t.Fatalf("create: %v", err)
	}

	got, err := s.GetSong(ctx, "song-1")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Metadata != song.Metadata || got.DurationMs != song.DurationMs || got.ProcessingStatus != song.ProcessingStatus {
		t.Errorf("round-trip mismatch: got %+v want %+v", got, song)
	}

	got.Metadata.Title = "edited"
	if err := s.UpdateSong(ctx, got); err != nil {
		t.Fatalf("update: %v", err)
	}
	updated, err := s.GetSong(ctx, "song-1")
	if err != nil {
		t.Fatalf("get after update: %v", err)
	}
	if updated.Metadata.Title != "edited" {
		t.Errorf("update not persisted: got %q", updated.Metadata.Title)
	}

	if err := s.DeleteSong(ctx, "song-1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := s.GetSong(ctx, "song-1"); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("get after delete: want ErrNotFound, got %v", err)
	}
}

func TestNotFoundSentinel(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()

	if _, err := s.GetSong(ctx, "missing"); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("GetSong: want ErrNotFound, got %v", err)
	}
	if err := s.DeleteSong(ctx, "missing"); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("DeleteSong: want ErrNotFound, got %v", err)
	}
	if err := s.UpdateSong(ctx, testSong("missing", time.Now().UTC(), store.ProcessingStatusPending)); !errors.Is(err, store.ErrNotFound) {
		t.Errorf("UpdateSong: want ErrNotFound, got %v", err)
	}
}

// TestListSongsPaginationWalk pages through the whole library and checks
// order, completeness, and token termination.
func TestListSongsPaginationWalk(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	base := time.Now().UTC().Truncate(time.Second)

	const total = 25
	for i := 0; i < total; i++ {
		song := testSong(fmt.Sprintf("song-%03d", i), base.Add(time.Duration(i)*time.Second), store.ProcessingStatusPending)
		if err := s.CreateSong(ctx, song); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}

	seen := map[string]bool{}
	token := ""
	pages := 0
	var previousID string
	for {
		songs, next, count, err := s.ListSongs(ctx, store.ListOptions{PageSize: 10, PageToken: token})
		if err != nil {
			t.Fatalf("list page %d: %v", pages, err)
		}
		if count != total {
			t.Errorf("total: got %d want %d", count, total)
		}
		for _, song := range songs {
			if seen[song.ID] {
				t.Errorf("song %s returned twice", song.ID)
			}
			seen[song.ID] = true
			// created_at DESC means IDs (created in order) descend too.
			if previousID != "" && song.ID >= previousID {
				t.Errorf("order violated: %s after %s", song.ID, previousID)
			}
			previousID = song.ID
		}
		pages++
		if next == "" {
			break
		}
		token = next
	}

	if len(seen) != total {
		t.Errorf("walked %d songs, want %d", len(seen), total)
	}
	if pages != 3 {
		t.Errorf("walked %d pages, want 3", pages)
	}
}

// TestListSongsDefaultPageSize covers the omitted-page-size path: identical
// timestamps force the id tie-breaker, and the second page must be reachable.
func TestListSongsDefaultPageSize(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)

	const total = 60
	for i := 0; i < total; i++ {
		if err := s.CreateSong(ctx, testSong(fmt.Sprintf("song-%03d", i), now, store.ProcessingStatusPending)); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}

	first, token, _, err := s.ListSongs(ctx, store.ListOptions{})
	if err != nil {
		t.Fatalf("first page: %v", err)
	}
	if len(first) != 50 {
		t.Errorf("first page size: got %d want 50", len(first))
	}
	if token == "" {
		t.Fatal("expected a next page token with 60 songs and default page size")
	}

	second, token, _, err := s.ListSongs(ctx, store.ListOptions{PageToken: token})
	if err != nil {
		t.Fatalf("second page: %v", err)
	}
	if len(second) != 10 {
		t.Errorf("second page size: got %d want 10", len(second))
	}
	if token != "" {
		t.Errorf("expected no token after the last page, got %q", token)
	}
}

func TestListSongsStatusFilter(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	now := time.Now().UTC()

	for i := 0; i < 3; i++ {
		status := store.ProcessingStatusPending
		if i == 0 {
			status = store.ProcessingStatusCompleted
		}
		if err := s.CreateSong(ctx, testSong(fmt.Sprintf("song-%d", i), now.Add(time.Duration(i)*time.Second), status)); err != nil {
			t.Fatalf("create: %v", err)
		}
	}

	songs, _, total, err := s.ListSongs(ctx, store.ListOptions{StatusFilter: store.ProcessingStatusCompleted})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(songs) != 1 || total != 1 {
		t.Errorf("filter: got %d songs (total %d), want 1", len(songs), total)
	}
}

// TestConcurrentClaims asserts every pending song is claimed exactly once
// even when many goroutines race for them.
func TestConcurrentClaims(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	base := time.Now().UTC()

	const total = 20
	for i := 0; i < total; i++ {
		if err := s.CreateSong(ctx, testSong(fmt.Sprintf("song-%03d", i), base.Add(time.Duration(i)*time.Millisecond), store.ProcessingStatusPending)); err != nil {
			t.Fatalf("create: %v", err)
		}
	}

	claimed := make(chan string, total*2)
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for {
				song, err := s.ClaimNextPendingSong(ctx)
				if err != nil {
					t.Errorf("claim: %v", err)
					return
				}
				if song == nil {
					return
				}
				claimed <- song.ID
			}
		}()
	}
	wg.Wait()
	close(claimed)

	seen := map[string]bool{}
	for id := range claimed {
		if seen[id] {
			t.Errorf("song %s claimed twice", id)
		}
		seen[id] = true
	}
	if len(seen) != total {
		t.Errorf("claimed %d songs, want %d", len(seen), total)
	}
}

func TestRequeueProcessingSongs(t *testing.T) {
	s := newTestStore(t)
	ctx := context.Background()
	now := time.Now().UTC()

	statuses := []store.ProcessingStatus{
		store.ProcessingStatusProcessing,
		store.ProcessingStatusProcessing,
		store.ProcessingStatusPending,
		store.ProcessingStatusCompleted,
	}
	for i, status := range statuses {
		if err := s.CreateSong(ctx, testSong(fmt.Sprintf("song-%d", i), now, status)); err != nil {
			t.Fatalf("create: %v", err)
		}
	}

	requeued, err := s.RequeueProcessingSongs(ctx)
	if err != nil {
		t.Fatalf("requeue: %v", err)
	}
	if requeued != 2 {
		t.Errorf("requeued %d songs, want 2", requeued)
	}

	_, _, pending, err := s.ListSongs(ctx, store.ListOptions{StatusFilter: store.ProcessingStatusPending})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if pending != 3 {
		t.Errorf("pending after requeue: got %d want 3", pending)
	}
}
