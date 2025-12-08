package sqlite

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// migrate runs the database migrations
func migrate(db *sql.DB) error {
	slog.Info("running database migrations")

	// Create schema_migrations table if it doesn't exist
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename TEXT PRIMARY KEY,
			applied_at DATETIME NOT NULL
		)
	`); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	// Get applied migrations
	applied, err := getAppliedMigrations(db)
	if err != nil {
		return fmt.Errorf("failed to get applied migrations: %w", err)
	}

	// Get all migration files
	files, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		return fmt.Errorf("failed to read migration files: %w", err)
	}

	// Sort migration files by name
	var migrations []string
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".sql") {
			migrations = append(migrations, file.Name())
		}
	}
	sort.Strings(migrations)

	// Run pending migrations
	for _, migration := range migrations {
		if applied[migration] {
			slog.Debug("migration already applied", "file", migration)
			continue
		}

		slog.Info("applying migration", "file", migration)
		if err := applyMigration(db, migration); err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", migration, err)
		}
	}

	slog.Info("database migrations completed successfully")
	return nil
}

func getAppliedMigrations(db *sql.DB) (map[string]bool, error) {
	rows, err := db.Query("SELECT filename FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var filename string
		if err := rows.Scan(&filename); err != nil {
			return nil, err
		}
		applied[filename] = true
	}

	return applied, rows.Err()
}

func applyMigration(db *sql.DB, filename string) error {
	// Read migration file
	path := fmt.Sprintf("migrations/%s", filename)
	content, err := fs.ReadFile(migrationFS, path)
	if err != nil {
		return fmt.Errorf("failed to read migration file %s: %w", filename, err)
	}

	// Start transaction
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Execute migration
	if _, err := tx.Exec(string(content)); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to execute migration %s: %w", filename, err)
	}

	// Mark migration as applied
	if _, err := tx.Exec(
		"INSERT INTO schema_migrations (filename, applied_at) VALUES (?, CURRENT_TIMESTAMP)",
		filename,
	); err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to record migration %s: %w", filename, err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration %s: %w", filename, err)
	}

	return nil
}
