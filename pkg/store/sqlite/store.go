package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"github.com/IceWreck/VoxStrip/pkg/store"
	_ "modernc.org/sqlite"
)

type sqliteStore struct {
	db *sql.DB
}

// NewStore creates a new SQLite store
func NewStore(dbPath string) (store.Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Run migrations
	if err := Migrate(db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	// Enable foreign key constraints
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
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
			original_file_path, vocal_file_path, instrumental_file_path,
			cover_art_path, duration_ms
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
		song.OriginalFilePath,
		song.VocalFilePath,
		song.InstrumentalFilePath,
		song.CoverArtPath,
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
			   original_file_path, vocal_file_path, instrumental_file_path,
			   cover_art_path, duration_ms
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
		&song.OriginalFilePath,
		&song.VocalFilePath,
		&song.InstrumentalFilePath,
		&song.CoverArtPath,
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

	// Build ORDER BY and LIMIT clauses
	orderClause := "ORDER BY created_at DESC"
	limitClause := fmt.Sprintf("LIMIT %d", opts.PageSize)
	if opts.PageSize <= 0 {
		limitClause = "LIMIT 50" // Default page size
	}

	// Add cursor-based pagination if page token is provided
	if opts.PageToken != "" {
		whereClause += fmt.Sprintf(" AND created_at < $%d", argIndex)
		args = append(args, opts.PageToken)
		argIndex++
	}

	// Execute query
	query := fmt.Sprintf(`
		SELECT id, title, artist, album, album_artist, genre, lyrics,
			   created_at, updated_at, processing_status, processing_error,
			   original_file_path, vocal_file_path, instrumental_file_path,
			   cover_art_path, duration_ms
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
			&song.OriginalFilePath,
			&song.VocalFilePath,
			&song.InstrumentalFilePath,
			&song.CoverArtPath,
			&song.DurationMs,
		)

		if err != nil {
			slog.Error("failed to scan song row", "error", err)
			return nil, "", 0, fmt.Errorf("failed to scan song row: %w", err)
		}

		song.ProcessingStatus = store.ProcessingStatus(processingStatus)
		songs = append(songs, &song)
		lastCreatedAt = song.CreatedAt
	}

	if err := rows.Err(); err != nil {
		slog.Error("error iterating song rows", "error", err)
		return nil, "", 0, fmt.Errorf("error iterating song rows: %w", err)
	}

	// Generate next page token
	var nextPageToken string
	if len(songs) > 0 && len(songs) == opts.PageSize {
		nextPageToken = lastCreatedAt.Format(time.RFC3339Nano)
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
			original_file_path = ?, vocal_file_path = ?, instrumental_file_path = ?,
			cover_art_path = ?, duration_ms = ?
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
		song.OriginalFilePath,
		song.VocalFilePath,
		song.InstrumentalFilePath,
		song.CoverArtPath,
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
