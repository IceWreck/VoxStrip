// WARNING: This file was vibecoded with an AI and the maintainer does not
// fully understand the DSP inside it. It somewhat works — the sweep test in
// pitch_test.go checks every semitone of the singing range — so re-run the
// tests after touching anything here.
//
// This file answers one question: what pitch is sounding in a single 64ms
// window of audio? It implements the McLeod pitch method: autocorrelate the
// window (normalized, "NSDF"), find the repeating-period peaks, and pick the
// first strong one as the fundamental frequency.

package pitch

import "math"

// Detection bounds for the singing voice, C2 to C6.
const (
	minFrequencyHz = 65.0
	maxFrequencyHz = 1050.0
)

// nsdfClarityThreshold is the minimum normalized peak height for a frame to
// count as pitched. Clean voiced frames score well above 0.9; separation
// artifacts and breath noise fall below.
const nsdfClarityThreshold = 0.8

// detectFrame estimates the fundamental frequency of one analysis window
// using the McLeod pitch method: pick the first key maximum of the normalized
// square difference function (NSDF) that is close enough to the global one.
// Returns the frequency in Hz and the peak clarity in [0, 1]; frequency is 0
// when the frame has no detectable pitch.
func detectFrame(window []float64, sampleRate int) (frequency, clarity float64) {
	maxLag := int(float64(sampleRate) / minFrequencyHz)
	minLag := int(float64(sampleRate) / maxFrequencyHz)
	if maxLag >= len(window) {
		maxLag = len(window) - 1
	}
	if minLag < 2 || minLag >= maxLag {
		return 0, 0
	}

	nsdf := computeNSDF(window, maxLag)
	peaks := keyMaxima(nsdf)
	if len(peaks) == 0 {
		return 0, 0
	}

	highest := 0.0
	for _, p := range peaks {
		if p.value > highest {
			highest = p.value
		}
	}
	if highest < nsdfClarityThreshold {
		return 0, highest
	}

	// The highest peak can sit at a subharmonic (an octave low); the first
	// peak within a tolerance of the highest is the true period. 0.93 follows
	// the reference MPM implementation (sevagh/pitch-detection).
	const peakTolerance = 0.93
	for _, p := range peaks {
		if p.value >= peakTolerance*highest {
			frequency := float64(sampleRate) / p.lag
			if frequency < minFrequencyHz || frequency > maxFrequencyHz {
				return 0, p.value
			}
			return frequency, p.value
		}
	}
	return 0, highest
}

// computeNSDF returns the normalized square difference function
// nsdf[tau] = 2*acf(tau) / (m(tau)) for tau in [0, maxLag].
func computeNSDF(window []float64, maxLag int) []float64 {
	n := len(window)
	nsdf := make([]float64, maxLag+1)
	for tau := 0; tau <= maxLag; tau++ {
		var acf, norm float64
		for i := 0; i < n-tau; i++ {
			acf += window[i] * window[i+tau]
			norm += window[i]*window[i] + window[i+tau]*window[i+tau]
		}
		if norm > 0 {
			nsdf[tau] = 2 * acf / norm
		}
	}
	return nsdf
}

type nsdfPeak struct {
	lag   float64
	value float64
}

// keyMaxima finds the highest point between each positive zero crossing pair
// of the NSDF, refining each with parabolic interpolation.
func keyMaxima(nsdf []float64) []nsdfPeak {
	var peaks []nsdfPeak
	i := 1

	// Skip the positive lobe around lag zero; the first real candidate peak
	// starts after the NSDF first dips below zero.
	for i < len(nsdf) && nsdf[i] > 0 {
		i++
	}

	for i < len(nsdf) {
		// Advance to the next positive crossing.
		for i < len(nsdf) && nsdf[i] <= 0 {
			i++
		}
		// Track the maximum until the NSDF goes negative again.
		bestIdx := -1
		for ; i < len(nsdf) && nsdf[i] > 0; i++ {
			if bestIdx == -1 || nsdf[i] > nsdf[bestIdx] {
				bestIdx = i
			}
		}
		if bestIdx > 0 && bestIdx < len(nsdf)-1 {
			lag, value := parabolicInterpolate(nsdf, bestIdx)
			peaks = append(peaks, nsdfPeak{lag: lag, value: value})
		}
	}
	return peaks
}

// parabolicInterpolate refines a discrete peak position by fitting a parabola
// through the peak sample and its neighbors.
func parabolicInterpolate(values []float64, idx int) (position, value float64) {
	left, mid, right := values[idx-1], values[idx], values[idx+1]
	denom := left - 2*mid + right
	if denom == 0 {
		return float64(idx), mid
	}
	shift := 0.5 * (left - right) / denom
	return float64(idx) + shift, mid - 0.25*(left-right)*shift
}

// midiFromFrequency converts a frequency in Hz to a fractional MIDI note
// number (A4 = 440Hz = 69).
func midiFromFrequency(frequency float64) float64 {
	return 69 + 12*math.Log2(frequency/440)
}
