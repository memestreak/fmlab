const TWO_PI = 2 * Math.PI;

/**
 * Simple FM at one instant: sin(wc t + I sin(wm t)), with `cycles` the
 * time measured in periods of the carrier and `ratio` wm / wc. The same
 * signal fmSpectrum takes apart and PmKernel plays.
 */
export function fmSample(cycles: number, ratio: number, index: number): number {
  return Math.sin(
    TWO_PI * cycles + index * Math.sin(TWO_PI * ratio * cycles),
  );
}

/** The modulator on its own at the same instant, at an amplitude of 1. */
export function modulatorSample(cycles: number, ratio: number): number {
  return Math.sin(TWO_PI * ratio * cycles);
}

/**
 * `count` evenly spaced samples of `fn` over the first `cycles` periods of
 * the carrier, both ends included, for drawing.
 */
export function sampleCycles(
  fn: (cycles: number) => number,
  cycles: number,
  count: number,
): Float32Array {
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = fn((i / (count - 1)) * cycles);
  }
  return samples;
}
