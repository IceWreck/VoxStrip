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

// demucsSeparator implements AudioSeparator using the Demucs CLI tool
type demucsSeparator struct {
	tempDir       string
	demucsCommand string
}

// newDemucsSeparator creates a new Demucs-based audio separator
func newDemucsSeparator(tempDir string, demucsCommand string) *demucsSeparator {
	return &demucsSeparator{
		tempDir:       tempDir,
		demucsCommand: demucsCommand,
	}
}

// separateVocals separates vocals and instruments using Demucs
func (d *demucsSeparator) separateVocals(ctx context.Context, songID, inputPath string) (vocalPath, instrumentalPath string, err error) {
	slog.Debug("starting audio separation", "input", inputPath)

	// Ensure temp directory exists
	if err := os.MkdirAll(d.tempDir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create temp directory: %w", err)
	}

	// Split the command to handle cases like "uv run demucs"
	parts := strings.Fields(d.demucsCommand)
	if len(parts) == 0 {
		parts = []string{"demucs"}
	}

	cmdName := parts[0]
	cmdArgs := append(parts[1:], "-n", "htdemucs", "--two-stems", "vocals", "--mp3", "--mp3-bitrate", "192", "--filename", songID+"_{stem}.{ext}", "-o", d.tempDir, inputPath)

	cmd := exec.CommandContext(ctx, cmdName, cmdArgs...)
	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	slog.Debug("running demucs", "command", cmdName, "args", strings.Join(cmdArgs, " "))

	// Run Demucs
	if err := cmd.Run(); err != nil {
		slog.Error("demucs command failed", "error", err, "stdout", stdout.String(), "stderr", stderr.String())
		return "", "", fmt.Errorf("demucs command failed: %w", err)
	}

	slog.Debug("demucs completed successfully", "stdout", stdout.String(), "stderr", stderr.String())

	// Find the output files
	// With --filename "{songID}_{stem}.{ext}", files are directly in tempDir/htdemucs/
	targetDir := filepath.Join(d.tempDir, "htdemucs")

	// Check for vocal and instrumental files with songID prefix
	vocalFile := filepath.Join(targetDir, songID+"_vocals.mp3")
	instrumentalFile := filepath.Join(targetDir, songID+"_no_vocals.mp3")

	// Verify files exist
	if _, err := os.Stat(vocalFile); os.IsNotExist(err) {
		return "", "", fmt.Errorf("vocal file not found at %s", vocalFile)
	}

	if _, err := os.Stat(instrumentalFile); os.IsNotExist(err) {
		return "", "", fmt.Errorf("instrumental file not found at %s", instrumentalFile)
	}

	slog.Debug("audio separation completed",
		"vocal", vocalFile,
		"instrumental", instrumentalFile,
	)

	return vocalFile, instrumentalFile, nil
}
