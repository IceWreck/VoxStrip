// Microphone pitch monitoring. Captures the singer's voice and emits pitch
// samples several times a second using the same McLeod pitch method the
// backend uses for the reference track (see pkg/processor/pitch).

// Detection bounds for the singing voice, matching the backend.
const MIN_FREQUENCY_HZ = 65;
const MAX_FREQUENCY_HZ = 1050;

// Mic input is noisier than a separated stem, so the clarity gate is a touch
// more forgiving than the backend's 0.8.
const CLARITY_THRESHOLD = 0.75;

// Frames quieter than this RMS are treated as silence rather than fed to the
// detector; keeps room noise from producing garbage pitches.
const LEVEL_FLOOR = 0.01;

// Analysis cadence. ~33 samples/second is plenty for per-line scoring.
const SAMPLE_INTERVAL_MS = 30;

// The analyser buffer is decimated by this factor before detection, cutting
// the autocorrelation cost ~9x with no accuracy loss in the vocal range.
const DECIMATION = 3;

export interface MicSample {
  // performance.now() timestamp of the reading.
  atMs: number;
  // Fractional MIDI note number, or null when silent/unpitched.
  midi: number | null;
  clarity: number;
  // RMS input level in [0, 1].
  level: number;
}

// MicPitchMonitor owns the microphone stream and analysis loop. Create with
// MicPitchMonitor.open() (may reject on permission denial), assign onSample,
// and close() to release the mic.
export class MicPitchMonitor {
  onSample: ((sample: MicSample) => void) | null = null;

  private constructor(
    private readonly stream: MediaStream,
    private readonly context: AudioContext,
    private readonly analyser: AnalyserNode,
  ) {
    this.timer = window.setInterval(() => this.analyze(), SAMPLE_INTERVAL_MS);
  }

  private timer: number;
  private readonly buffer = new Float32Array(2048);

  static async open(): Promise<MicPitchMonitor> {
    // Echo cancellation removes some of the instrumental playing through the
    // speakers; noise suppression and AGC are tuned for speech and mangle
    // sustained sung notes, so they stay off.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
    });

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    // Some browsers create the context suspended until a user gesture; the
    // enable-scoring click satisfies that.
    if (context.state === 'suspended') await context.resume();

    return new MicPitchMonitor(stream, context, analyser);
  }

  close(): void {
    window.clearInterval(this.timer);
    this.stream.getTracks().forEach((track) => track.stop());
    void this.context.close();
  }

  private analyze(): void {
    if (!this.onSample) return;
    this.analyser.getFloatTimeDomainData(this.buffer);

    const window = decimate(this.buffer, DECIMATION);
    const sampleRate = this.context.sampleRate / DECIMATION;
    const level = rms(window);

    if (level < LEVEL_FLOOR) {
      this.onSample({ atMs: performance.now(), midi: null, clarity: 0, level });
      return;
    }

    const { frequency, clarity } = detectPitch(window, sampleRate);
    const midi = frequency > 0 && clarity >= CLARITY_THRESHOLD ? midiFromFrequency(frequency) : null;
    this.onSample({ atMs: performance.now(), midi, clarity, level });
  }
}

function decimate(samples: Float32Array, factor: number): Float32Array {
  const out = new Float32Array(Math.floor(samples.length / factor));
  for (let i = 0; i < out.length; i++) {
    // Averaging acts as a crude anti-alias filter; fine for pitch use.
    let sum = 0;
    for (let j = 0; j < factor; j++) sum += samples[i * factor + j];
    out[i] = sum / factor;
  }
  return out;
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

export function midiFromFrequency(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

// detectPitch runs the McLeod pitch method over one analysis window: compute
// the normalized square difference function, pick its first key maximum
// within tolerance of the global one.
export function detectPitch(window: Float32Array, sampleRate: number): { frequency: number; clarity: number } {
  const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQUENCY_HZ), window.length - 1);
  const nsdf = computeNSDF(window, maxLag);
  const peaks = keyMaxima(nsdf);
  if (peaks.length === 0) return { frequency: 0, clarity: 0 };

  let highest = 0;
  for (const peak of peaks) highest = Math.max(highest, peak.value);
  if (highest < CLARITY_THRESHOLD) return { frequency: 0, clarity: highest };

  // The highest peak can sit at a subharmonic; the first peak within
  // tolerance of it is the true period (k=0.93, sevagh/pitch-detection).
  for (const peak of peaks) {
    if (peak.value >= 0.93 * highest) {
      const frequency = sampleRate / peak.lag;
      if (frequency < MIN_FREQUENCY_HZ || frequency > MAX_FREQUENCY_HZ) {
        return { frequency: 0, clarity: peak.value };
      }
      return { frequency, clarity: peak.value };
    }
  }
  return { frequency: 0, clarity: highest };
}

function computeNSDF(window: Float32Array, maxLag: number): Float64Array {
  const n = window.length;
  const nsdf = new Float64Array(maxLag + 1);
  for (let tau = 0; tau <= maxLag; tau++) {
    let acf = 0;
    let norm = 0;
    for (let i = 0; i < n - tau; i++) {
      acf += window[i] * window[i + tau];
      norm += window[i] * window[i] + window[i + tau] * window[i + tau];
    }
    nsdf[tau] = norm > 0 ? (2 * acf) / norm : 0;
  }
  return nsdf;
}

interface Peak {
  lag: number;
  value: number;
}

function keyMaxima(nsdf: Float64Array): Peak[] {
  const peaks: Peak[] = [];
  let i = 1;

  // Skip the positive lobe around lag zero.
  while (i < nsdf.length && nsdf[i] > 0) i++;

  while (i < nsdf.length) {
    while (i < nsdf.length && nsdf[i] <= 0) i++;
    let best = -1;
    for (; i < nsdf.length && nsdf[i] > 0; i++) {
      if (best === -1 || nsdf[i] > nsdf[best]) best = i;
    }
    if (best > 0 && best < nsdf.length - 1) {
      peaks.push(interpolatePeak(nsdf, best));
    }
  }
  return peaks;
}

function interpolatePeak(values: Float64Array, idx: number): Peak {
  const left = values[idx - 1];
  const mid = values[idx];
  const right = values[idx + 1];
  const denom = left - 2 * mid + right;
  if (denom === 0) return { lag: idx, value: mid };
  const shift = (0.5 * (left - right)) / denom;
  return { lag: idx + shift, value: mid - 0.25 * (left - right) * shift };
}
