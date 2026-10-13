/** The bottom of the output meter, in dB below full scale. */
export const METER_FLOOR_DB = -60;

/** The largest absolute sample in a block. */
export function peakOf(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const magnitude = Math.abs(samples[i]);
    if (magnitude > peak) peak = magnitude;
  }
  return peak;
}

/** A linear peak (1 is full scale) in dB. Silence is -Infinity. */
export function toDb(peak: number): number {
  return 20 * Math.log10(peak);
}

/**
 * Where a peak sits on the meter: 0 at METER_FLOOR_DB or quieter, 1 at
 * full scale or louder, linear in dB between, which is roughly how
 * loudness is heard.
 */
export function meterPosition(peak: number): number {
  if (peak <= 0) return 0;
  const position = 1 - toDb(peak) / METER_FLOOR_DB;
  return Math.min(1, Math.max(0, position));
}
