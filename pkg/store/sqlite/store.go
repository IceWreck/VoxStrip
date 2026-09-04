package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/IceWreck/VoxStrip/pkg/store"
	_ "modernc.org/sqlite"
)

type sqliteStore struct {
	db *sql.DB
}

// NewStore creates a new SQLite store
func NewStore(dbPath string) (store.Store, error) {
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	// Pragmas go in the DSN so every connection gets them; one-off Execs only
	// configure the connection they happen to run on.
	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Run migrations
	if err := migrate(db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	// Configure connection pool for better concurrency
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(5 * time.Minute)

	slog.Info("sqlite store initialized", "path", dbPath)

	return &sqliteStore{db: db}, nil
}

// Close closes the database connection
func (s *sqliteStore) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// CreateSong creates a new song in the database
func (s *sqliteStore) CreateSong(ctx context.Context, song *store.Song) error {
	query := `
		INSERT INTO songs (
			id, title, artist, album, album_artist, genre, lyrics,
			created_at, updated_at, processing_status, processing_error,
			duration_ms
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.ExecContext(ctx, query,
		song.ID,
		song.Metadata.Title,
		song.Metadata.Artist,
		song.Metadata.Album,
		song.Metadata.AlbumArtist,
		song.Metadata.Genre,
		song.Metadata.Lyrics,
		song.CreatedAt,
		song.UpdatedAt,
		int(song.ProcessingStatus),
		song.ProcessingError,
		song.DurationMs,
	)

	if err != nil {
		slog.Error("failed to create song", "id", song.ID, "error", err)
		return fmt.Errorf("failed to create song: %w", err)
	}

	slog.Debug("song created successfully", "id", song.ID)
	return nil
}

// GetSong retrieves a song by ID
func (s *sqliteStore) GetSong(ctx context.Context, id string) (*store.Song, error) {
	query := `
		SELECT id, title, artist, album, album_artist, genre, lyrics,
			   created_at, updated_at, processing_status, processing_error,
			   duration_ms
		FROM songs
		WHERE id = ?
	`

	row := s.db.QueryRowContext(ctx, query, id)
	var song store.Song
	var processingStatus int

	err := row.Scan(
		&song.ID,
		&song.Metadata.Title,
		&song.Metadata.Artist,
		&song.Metadata.Album,
		&song.Metadata.AlbumArtist,
		&song.Metadata.Genre,
		&song.Metadata.Lyrics,
		&song.CreatedAt,
		&song.UpdatedAt,
		&processingStatus,
		&song.ProcessingError,
		&song.DurationMs,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("song with id %s not found", id)
		}
		slog.Error("failed to get song", "id", id, "error", err)
		return nil, fmt.Errorf("failed to get song: %w", err)
	}

	song.ProcessingStatus = store.ProcessingStatus(processingStatus)
	return &song, nil
}

// ListSongs retrieves a paginated list of songs
func (s *sqliteStore) ListSongs(ctx context.Context, opts store.ListOptions) ([]*store.Song, string, int, error) {
	// Build WHERE clause
	whereClause := "WHERE 1=1"
	args := []interface{}{}
	argIndex := 1

	if opts.StatusFilter != store.ProcessingStatusUnspecified {
		whereClause += fmt.Sprintf(" AND processing_status = $%d", argIndex)
		args = append(args, int(opts.StatusFilter))
		argIndex++
	}

	// Get total count
	countQuery := "SELECT COUNT(*) FROM songs " + whereClause
	var total int
	if err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		slog.Error("failed to count songs", "error", err)
		return nil, "", 0, fmt.Errorf("failed to count songs: %w", err)
	}

	// Normalize the page size up front so the LIMIT and the next-token
	// condition agree even when the client omits page_size.
	if opts.PageSize <= 0 {
		opts.PageSize = 50
	}

	// Build ORDER BY and LIMIT clauses
	orderClause := "ORDER BY created_at DESC, id DESC"
	limitClause := fmt.Sprintf("LIMIT %d", opts.PageSize)

	// Add cursor-based pagination if page token is provided
	if opts.PageToken != "" {
		pageTime, songID, err := store.ParsePageToken(opts.PageToken)
		if err != nil {
			return nil, "", 0, err
		}

		whereClause += fmt.Sprintf(" AND (created_at < $%d OR (created_at = $%d AND id < $%d))", argIndex, argIndex+1, argIndex+2)
		args = append(args, pageTime, pageTime, songID)
		argIndex += 3
	}

	// Execute query
	query := fmt.Sprintf(`
		SELECT id, title, artist, album, album_artist, genre, lyrics,
			   created_at, updated_at, processing_status, processing_error,
			   duration_ms
		FROM songs
		%s %s %s
	`, whereClause, orderClause, limitClause)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		slog.Error("failed to list songs", "error", err)
		return nil, "", 0, fmt.Errorf("failed to list songs: %w", err)
	}
	defer rows.Close()

	var songs []*store.Song
	var lastCreatedAt time.Time
	var lastID string

	for rows.Next() {
		var song store.Song
		var processingStatus int

		err := rows.Scan(
			&song.ID,
			&song.Metadata.Title,
			&song.Metadata.Artist,
			&song.Metadata.Album,
			&song.Metadata.AlbumArtist,
			&song.Metadata.Genre,
			&song.Metadata.Lyrics,
			&song.CreatedAt,
			&song.UpdatedAt,
			&processingStatus,
			&song.ProcessingError,
			&song.DurationMs,
		)

		if err != nil {
			slog.Error("failed to scan song row", "error", err)
			return nil, "", 0, fmt.Errorf("failed to scan song row: %w", err)
		}

		song.ProcessingStatus = store.ProcessingStatus(processingStatus)
		songs = append(songs, &song)
		lastCreatedAt = song.CreatedAt
		lastID = song.ID
	}

	if err := rows.Err(); err != nil {
		slog.Error("error iterating song rows", "error", err)
		return nil, "", 0, fmt.Errorf("error iterating song rows: %w", err)
	}

	// Generate next page token
	var nextPageToken string
	if len(songs) > 0 && len(songs) == opts.PageSize {
		nextPageToken = store.EncodePageToken(lastCreatedAt, lastID)
	}

	slog.Debug("listed songs", "count", len(songs), "total", total, "has_next", nextPageToken != "")
	return songs, nextPageToken, total, nil
}

// UpdateSong updates an existing song
func (s *sqliteStore) UpdateSong(ctx context.Context, song *store.Song) error {
	query := `
		UPDATE songs SET
			title = ?, artist = ?, album = ?, album_artist = ?, genre = ?, lyrics = ?,
			updated_at = ?, processing_status = ?, processing_error = ?,
			duration_ms = ?
		WHERE id = ?
	`

	result, err := s.db.ExecContext(ctx, query,
		song.Metadata.Title,
		song.Metadata.Artist,
		song.Metadata.Album,
		song.Metadata.AlbumArtist,
		song.Metadata.Genre,
		song.Metadata.Lyrics,
		song.UpdatedAt,
		int(song.ProcessingStatus),
		song.ProcessingError,
		song.DurationMs,
		song.ID,
	)

	if err != nil {
		slog.Error("failed to update song", "id", song.ID, "error", err)
		return fmt.Errorf("failed to update song: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("song with id %s not found", song.ID)
	}

	slog.Debug("song updated successfully", "id", song.ID)
	return nil
}

// DeleteSong removes a song from the database
func (s *sqliteStore) DeleteSong(ctx context.Context, id string) error {
	query := "DELETE FROM songs WHERE id = ?"

	result, err := s.db.ExecContext(ctx, query, id)
	if err != nil {
		slog.Error("failed to delete song", "id", id, "error", err)
		return fmt.Errorf("failed to delete song: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("song with id %s not found", id)
	}

	slog.Debug("song deleted successfully", "id", id)
	return nil
}

// ClaimNextPendingSong atomically claims the next pending song for processing
func (s *sqliteStore) ClaimNextPendingSong(ctx context.Context) (*store.Song, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Find the next pending song
	query := `
		SELECT id, title, artist, album, album_artist, genre, lyrics,
			   created_at, updated_at, processing_status, processing_error,
			   duration_ms
		FROM songs
		WHERE processing_status = ?
		ORDER BY created_at ASC
		LIMIT 1
	`
	row := tx.QueryRowContext(ctx, query, int(store.ProcessingStatusPending))
	var song store.Song
	var processingStatus int

	err = row.Scan(
		&song.ID,
		&song.Metadata.Title,
		&song.Metadata.Artist,
		&song.Metadata.Album,
		&song.Metadata.AlbumArtist,
		&song.Metadata.Genre,
		&song.Metadata.Lyrics,
		&song.CreatedAt,
		&song.UpdatedAt,
		&processingStatus,
		&song.ProcessingError,
		&song.DurationMs,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // No pending songs
		}
		return nil, fmt.Errorf("failed to scan pending song: %w", err)
	}

	// Mark it as processing
	updateQuery := `
		UPDATE songs 
		SET processing_status = ?, updated_at = ?
		WHERE id = ? AND processing_status = ?
	`
	result, err := tx.ExecContext(ctx, updateQuery, int(store.ProcessingStatusProcessing), time.Now().UTC(), song.ID, int(store.ProcessingStatusPending))
	if err != nil {
		return nil, fmt.Errorf("failed to claim song: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		// Song was claimed by another worker
		return nil, nil
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	song.ProcessingStatus = store.ProcessingStatusProcessing
	slog.Debug("song claimed successfully", "id", song.ID)
	return &song, nil
}

// RequeueProcessingSongs resets songs stuck in the processing state back to
// pending so they get claimed again after a crash or restart.
func (s *sqliteStore) RequeueProcessingSongs(ctx context.Context) (int, error) {
	query := `
		UPDATE songs
		SET processing_status = ?, updated_at = ?
		WHERE processing_status = ?
	`
	result, err := s.db.ExecContext(ctx, query,
		int(store.ProcessingStatusPending),
		time.Now().UTC(),
		int(store.ProcessingStatusProcessing),
	)
	if err != nil {
		return 0, fmt.Errorf("failed to requeue processing songs: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}
	return int(rowsAffected), nil
}
