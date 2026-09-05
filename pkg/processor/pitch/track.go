// Package pitch extracts a reference pitch track from a separated vocal stem.
// The track is a sequence of sung notes (start, duration, fractional MIDI
// pitch) that the UI scores live singing against and renders as note bars.
package pitch

import (
	"encoding/json"
	"io"
	"math"
	"slices"
	"sort"
)

// TrackVersion identifies the JSON schema of a serialized track so the UI can
// reject blobs produced by an incompatible extractor.
const TrackVersion = 1

// Note is one continuous sung pitch. Midi is fractional (A4 = 69.0); scoring
// and display quantize as they see fit.
type Note struct {
	Start    float64 `json:"start"`
	Duration float64 `json:"duration"`
	Midi     float64 `json:"midi"`
}

// Track is the full reference pitch track for a song.
type Track struct {
	Version int    `json:"version"`
	Notes   []Note `json:"notes"`
}

// Analysis framing: 64ms windows every 16ms at the 16kHz analysis rate.
const (
	windowSize = 1024
	hopSize    = 256
)

// Note segmentation thresholds.
const (
	// minNoteFrames drops blips shorter than ~3 hops (48ms), which are almost
	// always separation artifacts or consonant noise.
	minNoteFrames = 3
	// pitchSplitSemitones ends a note when a frame departs this far from the
	// note's running median, so slides and interval changes become separate
	// notes while vibrato stays merged.
	pitchSplitSemitones = 0.9
	// maxGapFrames bridges single unvoiced frames inside a note; longer gaps
	// end it.
	maxGapFrames = 1
	// medianFilterWidth smooths per-frame pitch before segmentation to remove
	// isolated octave errors.
	medianFilterWidth = 5
)

// ExtractFromMP3 decodes an MP3 vocal stem and extracts its pitch track.
func ExtractFromMP3(r io.Reader) (*Track, error) {
	samples, err := decodeMP3Mono(r)
	if err != nil {
		return nil, err
	}
	return Extract(samples, analysisRate), nil
}

// Extract computes the pitch track of mono samples at the given rate.
func Extract(samples []float64, sampleRate int) *Track {
	frames := analyzeFrames(samples, sampleRate)
	medianFilterMidi(frames)
	return &Track{Version: TrackVersion, Notes: segmentNotes(frames, sampleRate)}
}

// frame is one analysis window result. midi is NaN for unvoiced frames.
type frame struct {
	midi float64
	rms  float64
}

// analyzeFrames runs pitch detection over the whole sample buffer.
func analyzeFrames(samples []float64, sampleRate int) []frame {
	if len(samples) < windowSize {
		return nil
	}

	frameCount := (len(samples)-windowSize)/hopSize + 1
	frames := make([]frame, frameCount)
	for i := range frames {
		window := samples[i*hopSize : i*hopSize+windowSize]
		frames[i] = frame{midi: math.NaN(), rms: rms(window)}
	}

	// Frames much quieter than the track's loud passages are breath, bleed,
	// or silence; skip detection there entirely. The floor is relative so
	// quietly mastered stems still work.
	energyFloor := energyThreshold(frames)

	for i := range frames {
		if frames[i].rms < energyFloor {
			continue
		}
		window := samples[i*hopSize : i*hopSize+windowSize]
		frequency, clarity := detectFrame(window, sampleRate)
		if frequency > 0 && clarity >= nsdfClarityThreshold {
			frames[i].midi = midiFromFrequency(frequency)
		}
	}
	return frames
}

// energyThreshold returns the RMS floor below which frames are treated as
// unvoiced: a fraction of the 95th percentile frame energy, with an absolute
// floor for near-silent tracks.
func energyThreshold(frames []frame) float64 {
	if len(frames) == 0 {
		return 0
	}
	energies := make([]float64, len(frames))
	for i, f := range frames {
		energies[i] = f.rms
	}
	sort.Float64s(energies)
	p95 := energies[len(energies)*95/100]
	return math.Max(0.008, 0.05*p95)
}

// medianFilterMidi replaces each voiced frame's pitch with the median of the
// voiced frames in a small window around it, removing isolated octave errors
// without shifting note boundaries.
func medianFilterMidi(frames []frame) {
	half := medianFilterWidth / 2
	filtered := make([]float64, len(frames))
	for i := range frames {
		filtered[i] = frames[i].midi
		if math.IsNaN(frames[i].midi) {
			continue
		}
		var window []float64
		for j := max(0, i-half); j <= min(len(frames)-1, i+half); j++ {
			if !math.IsNaN(frames[j].midi) {
				window = append(window, frames[j].midi)
			}
		}
		filtered[i] = median(window)
	}
	for i := range frames {
		frames[i].midi = filtered[i]
	}
}

// segmentNotes groups consecutive voiced frames into notes, splitting on
// pitch jumps and gaps longer than maxGapFrames.
func segmentNotes(frames []frame, sampleRate int) []Note {
	hopSeconds := float64(hopSize) / float64(sampleRate)
	notes := []Note{}

	var current []float64
	var currentStart int
	gap := 0

	flush := func(endFrame int) {
		if len(current) >= minNoteFrames {
			notes = append(notes, Note{
				Start:    float64(currentStart) * hopSeconds,
				Duration: float64(endFrame-currentStart) * hopSeconds,
				Midi:     median(current),
			})
		}
		current = nil
	}

	for i, f := range frames {
		if math.IsNaN(f.midi) {
			if current != nil {
				gap++
				if gap > maxGapFrames {
					flush(i - gap + 1)
					gap = 0
				}
			}
			continue
		}

		if current != nil && math.Abs(f.midi-median(current)) > pitchSplitSemitones {
			flush(i - gap)
			gap = 0
		}
		if current == nil {
			currentStart = i
		}
		gap = 0
		current = append(current, f.midi)
	}
	flush(len(frames))

	return notes
}

// Marshal serializes the track to its blobstore JSON representation.
func (t *Track) Marshal() ([]byte, error) {
	return json.Marshal(t)
}

func rms(window []float64) float64 {
	var sum float64
	for _, s := range window {
		sum += s * s
	}
	return math.Sqrt(sum / float64(len(window)))
}

// median returns the middle value of values; it copies before sorting so
// callers can keep appending to their slice.
func median(values []float64) float64 {
	if len(values) == 0 {
		return math.NaN()
	}
	sorted := slices.Clone(values)
	sort.Float64s(sorted)
	mid := len(sorted) / 2
	if len(sorted)%2 == 0 {
		return (sorted[mid-1] + sorted[mid]) / 2
	}
	return sorted[mid]
}
