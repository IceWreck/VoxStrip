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

// Migrate runs the database migrations
func Migrate(db *sql.DB) error {
	slog.Info("running database migrations")

	// Create schema_migrations table if it doesn't exist
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
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
		version := extractVersion(migration)
		if version == 0 {
			slog.Warn("skipping migration with invalid version", "file", migration)
			continue
		}

		if applied[version] {
			slog.Debug("migration already applied", "version", version, "file", migration)
			continue
		}

		slog.Info("applying migration", "version", version, "file", migration)
		if err := applyMigration(db, migration, version); err != nil {
			return fmt.Errorf("failed to apply migration %s: %w", migration, err)
		}
	}

	slog.Info("database migrations completed successfully")
	return nil
}

func getAppliedMigrations(db *sql.DB) (map[int]bool, error) {
	rows, err := db.Query("SELECT version FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[int]bool)
	for rows.Next() {
		var version int
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}

	return applied, rows.Err()
}

func extractVersion(filename string) int {
	// Extract version from filename like "001_initial_schema.sql"
	parts := strings.Split(filename, "_")
	if len(parts) == 0 {
		return 0
	}

	var versionStr string
	for _, part := range parts {
		if len(part) >= 3 && part[0] >= '0' && part[0] <= '9' {
			versionStr = part
			break
		}
	}

	var version int
	if _, err := fmt.Sscanf(versionStr, "%d", &version); err != nil {
		return 0
	}

	return version
}

func applyMigration(db *sql.DB, filename string, version int) error {
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
	defer tx.Rollback()

	// Execute migration
	if _, err := tx.Exec(string(content)); err != nil {
		return fmt.Errorf("failed to execute migration %s: %w", filename, err)
	}

	// Mark migration as applied
	if _, err := tx.Exec(
		"INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP)",
		version,
	); err != nil {
		return fmt.Errorf("failed to record migration %s: %w", filename, err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration %s: %w", filename, err)
	}

	return nil
}
