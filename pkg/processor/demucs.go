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

// NewDemucsSeparator creates a new Demucs-based audio separator
func NewDemucsSeparator(tempDir string, demucsCommand string) AudioSeparator {
	return &demucsSeparator{
		tempDir:       tempDir,
		demucsCommand: demucsCommand,
	}
}

// SeparateVocals separates vocals and instruments using Demucs
func (d *demucsSeparator) SeparateVocals(ctx context.Context, inputPath string) (vocalPath, instrumentalPath string, err error) {
	slog.Debug("starting audio separation", "input", inputPath)

	// Create output directory for this specific file
	outputDir := filepath.Join(d.tempDir, "demucs_output", filepath.Base(inputPath))
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", "", fmt.Errorf("failed to create output directory: %w", err)
	}

	// Parse the demucs command to determine how to execute it
	var cmdName string
	var cmdArgs []string

	// Split the command to handle cases like "uv run demucs"
	parts := strings.Fields(d.demucsCommand)
	if len(parts) > 0 {
		cmdName = parts[0]
		// Append the Demucs arguments at the end
		cmdArgs = append(parts[1:], "-n", "htdemucs", "--mp3", "--mp3-bitrate", "320", "-o", outputDir, inputPath)
	} else {
		cmdName = "demucs"
		cmdArgs = []string{"-n", "htdemucs", "--mp3", "--mp3-bitrate", "320", "-o", outputDir, inputPath}
	}

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
	// Demucs creates a subdirectory with the stem name
	stemDir := filepath.Join(outputDir, "htdemucs")
	if _, err := os.Stat(stemDir); os.IsNotExist(err) {
		// Try alternative naming (sometimes demucs uses filename without extension)
		baseName := strings.TrimSuffix(filepath.Base(inputPath), filepath.Ext(inputPath))
		stemDir = filepath.Join(outputDir, baseName)
	}

	// Check for vocal and instrumental files
	vocalFile := filepath.Join(stemDir, "vocals.mp3")
	instrumentalFile := filepath.Join(stemDir, "no_vocals.mp3")

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
