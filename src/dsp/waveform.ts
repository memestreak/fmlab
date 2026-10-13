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

/**
 * True FM at one instant: the carrier's frequency, not its phase, follows
 * the modulator, fc + deviation * sin(wm t). Its phase is that added up
 * from t = 0, which is wc t + I (1 - cos(wm t)) with I = deviation / fm.
 * The signal trueFmSpectrum takes apart and FmKernel plays.
 */
export function trueFmSample(cycles: number, ratio: number, index: number): number {
  return Math.sin(
    TWO_PI * cycles + index * (1 - Math.cos(TWO_PI * ratio * cycles)),
  );
}

/**
 * True FM seen through a window that opens at time `start`: the signal
 * `offset` seconds into the window, with the carrier's phase counted from
 * the window's left edge, so the wave always starts there at zero, rising.
 *
 * Its phase is the frequency fc + deviation * sin(wm t) added up from
 * `start` to `start + offset`. As `start` moves on, the left edge stays
 * put and the waves to its right squeeze and stretch: a picture of the
 * pitch moving, that stands still when there is no modulation. All in
 * seconds and Hz; `carrierHz` may be a slowed-down stand-in for the real
 * carrier.
 */
export function fmWindowSample(
  start: number,
  offset: number,
  carrierHz: number,
  modHz: number,
  deviationHz: number,
): number {
  const index = deviationHz / modHz;
  return Math.sin(
    TWO_PI * carrierHz * offset +
      index *
        (Math.cos(TWO_PI * modHz * start) -
          Math.cos(TWO_PI * modHz * (start + offset))),
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
