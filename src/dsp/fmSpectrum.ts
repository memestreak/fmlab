import { besselJSeries } from './bessel';

/** One partial of a spectrum. */
export interface SpectralLine {
  /** Frequency in carrier units: 1 is the carrier, 2 an octave above it. */
  freq: number;
  /**
   * Amplitude, against a carrier of 1 with no modulation. From fmSpectrum
   * the sign is the phase: a negative line is a sine turned upside down.
   * From trueFmSpectrum it is a magnitude, never negative.
   */
  amp: number;
}

/** Lines quieter than this (-80 dB) are left out. */
export const MIN_AMPLITUDE = 1e-4;

/** Frequencies closer than this are the same line. */
const FREQ_RESOLUTION = 1e-9;

/** A line as a phasor: amp * sin(w t + phase) is (re, im) = amp e^(i phase). */
interface Phasor {
  re: number;
  im: number;
}

/**
 * The sidebands of sin(wc t + carrierPhase + I sin(wm t + modPhase)),
 * gathered by frequency.
 *
 * The signal is the sum over every integer n of
 *
 *   J_n(I) sin((wc + n wm) t + carrierPhase + n modPhase)
 *
 * so sideband n sits at 1 + n * ratio. A sideband below zero is the same
 * sine running backwards, sin(-x) = -sin(x), so it folds to the positive
 * frequency with its phase negated and half a turn added. Lines that land
 * on the same frequency are added as phasors. A line at exactly zero is
 * dropped: it is a constant, not a sound.
 */
function sidebands(
  ratio: number,
  index: number,
  carrierPhase: number,
  modPhase: number,
): Map<number, Phasor> {
  // Past n = |I| the sidebands only get quieter. This many more reaches
  // the floor: the fall-off widens as the cube root of the index.
  const reach = Math.ceil(Math.abs(index) + 6 * Math.cbrt(Math.abs(index)) + 8);
  const bessel = besselJSeries(reach, index);

  // Bucketed by rounded frequency so coincident lines meet.
  const lines = new Map<number, Phasor>();
  const add = (n: number, amp: number) => {
    let freq = 1 + n * ratio;
    let phase = carrierPhase + n * modPhase;
    if (freq < 0) {
      freq = -freq;
      phase = Math.PI - phase;
    }
    const key = Math.round(freq / FREQ_RESOLUTION);
    if (key === 0) return;
    const line = lines.get(key) ?? { re: 0, im: 0 };
    line.re += amp * Math.cos(phase);
    line.im += amp * Math.sin(phase);
    lines.set(key, line);
  };

  add(0, bessel[0]);
  for (let n = 1; n <= reach; n++) {
    const upper = bessel[n];
    add(n, upper);
    // J_-n = (-1)^n J_n
    add(-n, n % 2 === 0 ? upper : -upper);
    if (n > Math.abs(index) && Math.abs(upper) < MIN_AMPLITUDE) break;
  }
  return lines;
}

/** Turns the buckets into lines, loudest-enough only, in ascending frequency. */
function toLines(
  lines: Map<number, Phasor>,
  amplitude: (phasor: Phasor) => number,
): SpectralLine[] {
  return [...lines]
    .map(([key, phasor]) => ({
      freq: key * FREQ_RESOLUTION,
      amp: amplitude(phasor),
    }))
    .filter(line => Math.abs(line.amp) >= MIN_AMPLITUDE)
    .sort((a, b) => a.freq - b.freq);
}

/**
 * The line spectrum of simple FM as the lab plays it, by phase modulation:
 * sin(wc t + I sin(wm t)), where `ratio` is wm / wc and `index` is I.
 *
 * Both sines start together, so every line is a sine either the right way
 * up or upside down, and the amplitude's sign says which. That is where a
 * ratio of 1 gets its cancellations: the carrier's line is J0 - J2.
 */
export function fmSpectrum(ratio: number, index: number): SpectralLine[] {
  // With no phase offsets every phasor lies on the real axis.
  return toLines(sidebands(ratio, index, 0, 0), phasor => phasor.re);
}

/**
 * The line spectrum of true frequency modulation, where the modulator
 * moves the carrier's frequency rather than its phase:
 *
 *   frequency(t) = fc + deviation * sin(wm t)
 *
 * Adding that up from t = 0 gives the phase wc t + I (1 - cos(wm t)) with
 * I = deviation / fm, which is the phase-modulated signal with the
 * modulator a quarter turn late and the carrier I radians ahead. The
 * sidebands are the same sizes but no longer simply upright or inverted,
 * so the amplitudes here are magnitudes.
 */
export function trueFmSpectrum(ratio: number, index: number): SpectralLine[] {
  return toLines(sidebands(ratio, index, index, -Math.PI / 2), phasor =>
    Math.hypot(phasor.re, phasor.im),
  );
}
