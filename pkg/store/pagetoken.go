package store

import (
	"fmt"
	"strings"
	"time"
)

// EncodePageToken builds the cursor token for pagination: the created_at and
// id of the last song on the page.
func EncodePageToken(createdAt time.Time, id string) string {
	return fmt.Sprintf("%s|%s", createdAt.UTC().Format(time.RFC3339Nano), id)
}

// ParsePageToken parses a token produced by EncodePageToken.
func ParsePageToken(token string) (time.Time, string, error) {
	parts := strings.Split(token, "|")
	if len(parts) != 2 {
		return time.Time{}, "", fmt.Errorf("invalid page token format")
	}
	createdAt, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return time.Time{}, "", fmt.Errorf("invalid page token format: %w", err)
	}
	return createdAt, parts[1], nil
}
