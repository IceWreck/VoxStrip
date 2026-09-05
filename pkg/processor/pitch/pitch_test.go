package pitch

import (
	"math"
	"testing"
)

// synth appends duration seconds of a tone with the given fundamental to
// samples, with a few harmonics so it resembles a voice more than a pure
// sine.
func synth(samples []float64, frequency, duration float64, sampleRate int) []float64 {
	n := int(duration * float64(sampleRate))
	for i := range n {
		t := float64(i) / float64(sampleRate)
		s := 0.6*math.Sin(2*math.Pi*frequency*t) +
			0.25*math.Sin(2*math.Pi*2*frequency*t) +
			0.1*math.Sin(2*math.Pi*3*frequency*t)
		samples = append(samples, s)
	}
	return samples
}

func silence(samples []float64, duration float64, sampleRate int) []float64 {
	return append(samples, make([]float64, int(duration*float64(sampleRate)))...)
}

func TestExtractTwoNotesWithSilence(t *testing.T) {
	var samples []float64
	samples = silence(samples, 0.3, analysisRate)
	samples = synth(samples, 220, 0.5, analysisRate) // A3 = midi 57
	samples = silence(samples, 0.3, analysisRate)
	samples = synth(samples, 330, 0.5, analysisRate) // E4 ~= midi 64.02
	samples = silence(samples, 0.3, analysisRate)

	track := Extract(samples, analysisRate)
	if len(track.Notes) != 2 {
		t.Fatalf("expected 2 notes, got %d: %+v", len(track.Notes), track.Notes)
	}

	first, second := track.Notes[0], track.Notes[1]
	if math.Abs(first.Midi-57) > 0.3 {
		t.Errorf("first note midi = %.2f, want ~57", first.Midi)
	}
	if math.Abs(second.Midi-64.02) > 0.3 {
		t.Errorf("second note midi = %.2f, want ~64", second.Midi)
	}
	if math.Abs(first.Start-0.3) > 0.1 {
		t.Errorf("first note start = %.2f, want ~0.3", first.Start)
	}
	if math.Abs(first.Duration-0.5) > 0.1 {
		t.Errorf("first note duration = %.2f, want ~0.5", first.Duration)
	}
}

func TestExtractVibratoStaysOneNote(t *testing.T) {
	// 440Hz with +-0.3 semitone vibrato at 5.5Hz, typical for a singer.
	var samples []float64
	n := int(1.5 * analysisRate)
	phase := 0.0
	for i := range n {
		t := float64(i) / analysisRate
		frequency := 440 * math.Pow(2, 0.3*math.Sin(2*math.Pi*5.5*t)/12)
		phase += 2 * math.Pi * frequency / analysisRate
		samples = append(samples, 0.7*math.Sin(phase)+0.2*math.Sin(2*phase))
	}

	track := Extract(samples, analysisRate)
	if len(track.Notes) != 1 {
		t.Fatalf("expected vibrato to stay one note, got %d: %+v", len(track.Notes), track.Notes)
	}
	if math.Abs(track.Notes[0].Midi-69) > 0.3 {
		t.Errorf("vibrato note midi = %.2f, want ~69", track.Notes[0].Midi)
	}
}

func TestExtractIntervalJumpSplitsNotes(t *testing.T) {
	// Two notes a fourth apart with no gap between them.
	var samples []float64
	samples = synth(samples, 262, 0.5, analysisRate) // C4 ~= midi 60
	samples = synth(samples, 349, 0.5, analysisRate) // F4 ~= midi 65
	track := Extract(samples, analysisRate)
	if len(track.Notes) != 2 {
		t.Fatalf("expected interval jump to split notes, got %d: %+v", len(track.Notes), track.Notes)
	}
}

func TestExtractSilenceHasNoNotes(t *testing.T) {
	track := Extract(make([]float64, 3*analysisRate), analysisRate)
	if len(track.Notes) != 0 {
		t.Fatalf("expected no notes in silence, got %+v", track.Notes)
	}
}

func TestExtractNoiseHasNoNotes(t *testing.T) {
	// Deterministic pseudo-noise; aperiodic frames must fail the clarity
	// threshold.
	samples := make([]float64, 2*analysisRate)
	seed := uint64(1)
	for i := range samples {
		seed = seed*6364136223846793005 + 1442695040888963407
		samples[i] = (float64(seed>>11)/float64(1<<53) - 0.5) * 0.8
	}
	track := Extract(samples, analysisRate)
	if len(track.Notes) != 0 {
		t.Fatalf("expected no notes in noise, got %+v", track.Notes)
	}
}

func TestDetectFrameFrequencySweep(t *testing.T) {
	// Every semitone across the singing range must be detected within 20
	// cents on a clean harmonic tone.
	for midi := 41; midi <= 81; midi++ { // F2..A5
		frequency := 440 * math.Pow(2, float64(midi-69)/12)
		window := synth(nil, frequency, float64(windowSize+1)/analysisRate, analysisRate)[:windowSize]
		detected, clarity := detectFrame(window, analysisRate)
		if detected == 0 {
			t.Errorf("midi %d (%.1fHz): no pitch detected (clarity %.2f)", midi, frequency, clarity)
			continue
		}
		cents := 1200 * math.Log2(detected/frequency)
		if math.Abs(cents) > 20 {
			t.Errorf("midi %d (%.1fHz): detected %.1fHz, off by %.0f cents", midi, frequency, detected, cents)
		}
	}
}

func TestResampleLinearPreservesFrequency(t *testing.T) {
	source := synth(nil, 440, 1, 44100)
	resampled := resampleLinear(source, 44100, analysisRate)
	window := resampled[100 : 100+windowSize]
	detected, _ := detectFrame(window, analysisRate)
	if detected == 0 || math.Abs(1200*math.Log2(detected/440)) > 20 {
		t.Errorf("resampled 440Hz detected as %.1fHz", detected)
	}
}
