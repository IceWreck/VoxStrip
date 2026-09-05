// WARNING: This file was vibecoded with an AI along with the rest of the
// package. It is a manual harness, not an assertion suite: point it at a
// real vocal stem and eyeball the note count, sung time, and pitch range it
// prints.

package pitch

import (
	"fmt"
	"os"
	"testing"
)

// TestExtractFromRealStem runs the extractor against a real vocal stem for
// manual inspection. Skipped unless VOXSTRIP_PITCH_TEST_FILE points at an MP3:
//
//	VOXSTRIP_PITCH_TEST_FILE=./data/blobs/vocal/<id>.mp3 go test -v -run TestExtractFromRealStem ./pkg/processor/pitch/
func TestExtractFromRealStem(t *testing.T) {
	path := os.Getenv("VOXSTRIP_PITCH_TEST_FILE")
	if path == "" {
		t.Skip("set VOXSTRIP_PITCH_TEST_FILE to run against a real stem")
	}

	file, err := os.Open(path)
	if err != nil {
		t.Fatalf("failed to open test file: %v", err)
	}
	defer file.Close()

	track, err := ExtractFromMP3(file)
	if err != nil {
		t.Fatalf("extraction failed: %v", err)
	}
	if len(track.Notes) == 0 {
		t.Fatal("expected notes in a real vocal stem, got none")
	}

	var sung, minMidi, maxMidi float64
	minMidi, maxMidi = 200, 0
	for _, n := range track.Notes {
		sung += n.Duration
		minMidi = min(minMidi, n.Midi)
		maxMidi = max(maxMidi, n.Midi)
	}
	last := track.Notes[len(track.Notes)-1]

	fmt.Printf("notes=%d sung=%.1fs span=%.1fs midi=[%.1f..%.1f]\n",
		len(track.Notes), sung, last.Start+last.Duration, minMidi, maxMidi)
	for _, n := range track.Notes[:min(15, len(track.Notes))] {
		fmt.Printf("  %7.2fs +%.2fs midi %.1f\n", n.Start, n.Duration, n.Midi)
	}
}
