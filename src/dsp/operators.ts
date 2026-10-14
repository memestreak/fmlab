import { algorithm } from './algorithms';
import type { Envelope } from './envelope';
import { fftMagnitudes } from './fft';
import type { SpectralLine } from './fmSpectrum';
import { type Algorithm, MAX_OPERATORS, PmKernel } from './pmKernel';

/**
 * One of six operators, in clean units: its frequency as a ratio of the
 * note's, its output level from 0 to 1, and how many seconds it takes to
 * die away once struck (0: it holds for as long as the note does).
 */
export interface Operator {
  ratio: number;
  level: number;
  decay: number;
}

/**
 * The modulation index an operator at full level gives the operator it
 * modulates, in radians. Level is one dial for every operator, as on the
 * DX7; what it means depends on where the algorithm puts the operator.
 */
export const MOD_INDEX = 5;

/**
 * The levels the kernel takes, from the operators' levels and the
 * algorithm: a modulator's level becomes its index (level times
 * MOD_INDEX); a carrier's becomes its share of the sound, divided by how
 * many carriers there are, so the sound stays the same loudness whichever
 * algorithm is chosen. Shared by the worklet and the predicted spectrum,
 * so the two scale alike.
 */
export function kernelLevels(
  alg: Algorithm,
  levels: ArrayLike<number>,
  // The audio thread passes its own, so as not to make one every sample.
  out = new Float64Array(MAX_OPERATORS),
): Float64Array {
  for (let op = 0; op < MAX_OPERATORS; op++) {
    out[op] = alg.carriers.includes(op)
      ? levels[op] / alg.carriers.length
      : levels[op] * MOD_INDEX;
  }
  return out;
}

/** A note of six operators lasts at least this long, held. */
const MIN_HOLD = 1;
/** And at most this. */
const MAX_HOLD = 6;
/** Every operator is struck this quickly, and let go this slowly. */
const ATTACK = 0.005;
const RELEASE = 0.3;

/**
 * How long a note of these operators is held before it is let go: long
 * enough for the slowest to die away, within limits.
 */
export function noteHold(operators: readonly Operator[]): number {
  const longest = Math.max(0, ...operators.map(op => op.decay));
  return Math.min(MAX_HOLD, Math.max(MIN_HOLD, longest));
}

/**
 * One operator's envelope over a note: struck at once, then dying away
 * over its decay time, or held; let go with the rest at `hold`.
 */
export function operatorEnvelope(op: Operator, hold: number): Envelope {
  return op.decay > 0
    ? { attack: ATTACK, decay: op.decay, sustain: 0, release: RELEASE, hold }
    : { attack: ATTACK, decay: 1, sustain: 1, release: RELEASE, hold };
}

/** The predicted spectrum is worked out from this many samples. */
const SAMPLES = 16384;
/** At this many samples to a cycle of the note: up to 32 times its pitch. */
const PER_CYCLE = 64;
/** Run this long first, so feedback has settled. */
const SETTLE = 1024;
/**
 * The window: a flat-top one, which reads a partial's height within a
 * hundredth of a decibel wherever it falls between the transform's bins
 * (a narrower window can read one between bins nearly a tenth low), with
 * side lobes about 90 dB down. The price is a wide peak, five bins each
 * side, which here is a twentieth of the note's pitch: partials closer
 * than that run together. WINDOW_GAIN is what it leaves of a sine's
 * height.
 */
const WINDOW = [0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368];
const WINDOW_GAIN = WINDOW[0];
/** Partials quieter than this, against the loudest, are left out. */
const FLOOR = 1e-3;

/**
 * The line spectrum of six operators, in carrier units: what the note is
 * made of, partial by partial. With more than two operators no tidy sum of
 * Bessel functions gives it, so it is worked out the long way. The kernel
 * that plays the sound is run for a moment, the result windowed and
 * transformed, and each peak read off as a partial at its frequency and
 * height. The heights are magnitudes; phase is left out.
 *
 * @param levels each operator's level at the moment wanted, 0 to 1
 */
export function operatorSpectrum(
  algorithmNumber: number,
  ratios: readonly number[],
  levels: readonly number[],
  feedback: number,
): SpectralLine[] {
  const alg = algorithm(algorithmNumber);
  const kernel = new PmKernel(alg, 1);
  const scaled = kernelLevels(alg, levels);
  const samples = new Float64Array(SAMPLES);
  for (let i = 0; i < SETTLE; i++) kernel.tick(1 / PER_CYCLE, ratios, scaled, feedback);
  for (let i = 0; i < SAMPLES; i++) {
    const t = (2 * Math.PI * i) / (SAMPLES - 1);
    const w =
      WINDOW[0] -
      WINDOW[1] * Math.cos(t) +
      WINDOW[2] * Math.cos(2 * t) -
      WINDOW[3] * Math.cos(3 * t) +
      WINDOW[4] * Math.cos(4 * t);
    samples[i] = w * kernel.tick(1 / PER_CYCLE, ratios, scaled, feedback);
  }
  const magnitudes = fftMagnitudes(samples);

  // Each peak's height as an amplitude: the transform gives half of it at
  // the positive frequency, times what the window leaves.
  const height = (bin: number) => (2 * magnitudes[bin]) / (SAMPLES * WINDOW_GAIN);
  let loudest = 0;
  for (let bin = 1; bin < magnitudes.length; bin++) loudest = Math.max(loudest, height(bin));
  const lines: SpectralLine[] = [];
  for (let bin = 2; bin < magnitudes.length - 2; bin++) {
    const here = magnitudes[bin];
    if (here < magnitudes[bin - 1] || here < magnitudes[bin + 1]) continue;
    if (height(bin) < FLOOR * loudest || height(bin) < 1e-5) continue;
    // Between bins, the peak's true place by a parabola through the three.
    const [a, b, c] = [magnitudes[bin - 1], here, magnitudes[bin + 1]];
    const shift = (0.5 * (a - c)) / (a - 2 * b + c || 1);
    const freq = ((bin + shift) * PER_CYCLE) / SAMPLES;
    lines.push({ freq, amp: height(bin) });
  }
  return lines;
}
