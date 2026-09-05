package pitch

import (
	"fmt"
	"io"

	mp3 "github.com/hajimehoshi/go-mp3"
)

// analysisRate is the sample rate audio is resampled to before pitch
// detection. 16kHz keeps the autocorrelation cheap while leaving plenty of
// headroom above the vocal fundamental range.
const analysisRate = 16000

// decodeMP3Mono decodes an MP3 stream into mono float64 samples at
// analysisRate.
func decodeMP3Mono(r io.Reader) ([]float64, error) {
	decoder, err := mp3.NewDecoder(r)
	if err != nil {
		return nil, fmt.Errorf("failed to open mp3 stream: %w", err)
	}

	// go-mp3 always outputs 16-bit little-endian stereo.
	raw, err := io.ReadAll(decoder)
	if err != nil {
		return nil, fmt.Errorf("failed to decode mp3 stream: %w", err)
	}

	frameCount := len(raw) / 4
	mono := make([]float64, frameCount)
	for i := range frameCount {
		left := int16(uint16(raw[i*4]) | uint16(raw[i*4+1])<<8)
		right := int16(uint16(raw[i*4+2]) | uint16(raw[i*4+3])<<8)
		mono[i] = (float64(left) + float64(right)) / (2 * 32768)
	}

	return resampleLinear(mono, decoder.SampleRate(), analysisRate), nil
}

// resampleLinear converts samples between rates with linear interpolation.
// Aliasing above the Nyquist of the target rate is acceptable here: only the
// fundamental below ~1kHz matters and the autocorrelation is dominated by it.
func resampleLinear(samples []float64, fromRate, toRate int) []float64 {
	if fromRate == toRate || len(samples) == 0 {
		return samples
	}

	ratio := float64(fromRate) / float64(toRate)
	outLen := int(float64(len(samples)) / ratio)
	out := make([]float64, outLen)
	for i := range out {
		pos := float64(i) * ratio
		idx := int(pos)
		if idx+1 >= len(samples) {
			out[i] = samples[len(samples)-1]
			continue
		}
		frac := pos - float64(idx)
		out[i] = samples[idx]*(1-frac) + samples[idx+1]*frac
	}
	return out
}
