package processor

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// karaokeMixer handles mixing vocal and instrumental audio for karaoke version
type karaokeMixer struct {
	tempDir string
}

// newKaraokeMixer creates a new karaoke mixer
func newKaraokeMixer(tempDir string) *karaokeMixer {
	return &karaokeMixer{
		tempDir: tempDir,
	}
}

// mixKaraoke creates a karaoke version by mixing vocals at reduced volume with instrumentals
// Returns path to the mixed karaoke file
func (m *karaokeMixer) mixKaraoke(ctx context.Context, songID, vocalPath, instrumentalPath string) (string, error) {
	slog.Debug("creating karaoke version", "song_id", songID, "vocal", vocalPath, "instrumental", instrumentalPath)

	// Ensure temp directory exists
	if err := os.MkdirAll(m.tempDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create temp directory: %w", err)
	}

	// Create karaoke output file path
	karaokePath := filepath.Join(m.tempDir, fmt.Sprintf("karaoke-%s.mp3", songID))

	// Use ffmpeg to create karaoke: apply volume to vocal stream before mixing
	// Stream 0 (instrumental): volume 1.0, Stream 1 (vocal): volume 0.15, then mix
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-i", instrumentalPath,
		"-i", vocalPath,
		"-filter_complex", "[0:a]volume=1.0[instr];[1:a]volume=0.15[voc];[instr][voc]amix=inputs=2:duration=longest",
		"-c:a", "libmp3lame",
		"-b:a", "192k",
		"-y",
		karaokePath,
	)

	slog.Debug("running ffmpeg for karaoke mixing", "args", strings.Join(cmd.Args[1:], " "))

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		slog.Error("ffmpeg command failed", "error", err, "stdout", stdout.String(), "stderr", stderr.String())
		return "", fmt.Errorf("ffmpeg command failed: %w", err)
	}

	// Verify the output file was created
	if _, err := os.Stat(karaokePath); os.IsNotExist(err) {
		return "", fmt.Errorf("karaoke file was not created at %s", karaokePath)
	}

	slog.Debug("karaoke version created", "song_id", songID, "output", karaokePath)
	return karaokePath, nil
}
