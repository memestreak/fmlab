import { besselJ } from './bessel';

/** One partial of a spectrum. */
export interface SpectralLine {
  /** Frequency in carrier units: 1 is the carrier, 2 an octave above it. */
  freq: number;
  /**
   * Amplitude, against a carrier of 1 with no modulation. The sign is the
   * phase: a negative line is a sine turned upside down.
   */
  amp: number;
}

/** Lines quieter than this (-80 dB) are left out. */
export const MIN_AMPLITUDE = 1e-4;

/** Frequencies closer than this are the same line. */
const FREQ_RESOLUTION = 1e-9;

/**
 * The line spectrum of simple FM, sin(wc t + I sin(wm t)), where
 * `ratio` is wm / wc and `index` is I.
 *
 * The signal is the sum over every integer n of J_n(I) sin((wc + n wm) t),
 * so sideband n sits at 1 + n * ratio with amplitude J_n(I). A sideband
 * below zero is the same sine running backwards, sin(-x) = -sin(x), so it
 * folds to the positive frequency with its sign flipped. Lines that land on
 * the same frequency are summed, which is where a ratio of 1 gets its
 * cancellations. A line at exactly zero is sin(0) and is dropped.
 *
 * Lines come back in ascending frequency.
 */
export function fmSpectrum(ratio: number, index: number): SpectralLine[] {
  // Bucketed by rounded frequency so coincident lines meet.
  const amps = new Map<number, number>();
  const add = (n: number, amp: number) => {
    let freq = 1 + n * ratio;
    if (freq < 0) {
      freq = -freq;
      amp = -amp;
    }
    const key = Math.round(freq / FREQ_RESOLUTION);
    if (key === 0) return;
    amps.set(key, (amps.get(key) ?? 0) + amp);
  };

  add(0, besselJ(0, index));
  // Past n = |I| the sidebands only get quieter, so the first one below the
  // floor out there is the last worth having.
  for (let n = 1; ; n++) {
    const upper = besselJ(n, index);
    add(n, upper);
    add(-n, n % 2 === 0 ? upper : -upper);
    if (n > Math.abs(index) && Math.abs(upper) < MIN_AMPLITUDE) break;
  }

  return [...amps]
    .map(([key, amp]) => ({ freq: key * FREQ_RESOLUTION, amp }))
    .filter(line => Math.abs(line.amp) >= MIN_AMPLITUDE)
    .sort((a, b) => a.freq - b.freq);
}
