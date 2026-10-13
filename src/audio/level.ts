/** The bottom of the output meter, in dB below full scale. */
export const METER_FLOOR_DB = -60;

/** How long the meter's peak marker stays put before it starts to fall. */
export const PEAK_HOLD_MS = 1000;
/** How fast it then falls, in meter lengths per second. */
export const PEAK_FALL_PER_SECOND = 0.5;

/** The peak marker: where it is, and when the level last reached it. */
export interface PeakHold {
  position: number;
  /** Time of the last push up, in ms. */
  at: number;
}

/**
 * Moves the peak marker on. A level at or above it carries it up at once;
 * otherwise it stays where it is for PEAK_HOLD_MS and then falls steadily,
 * never below the level.
 *
 * @param position the meter position now, 0 to 1
 * @param now the time now, in ms
 * @param elapsed ms since the last call
 */
export function holdPeak(
  peak: PeakHold,
  position: number,
  now: number,
  elapsed: number,
): PeakHold {
  if (position >= peak.position) return { position, at: now };
  if (now - peak.at < PEAK_HOLD_MS) return peak;
  const fallen = peak.position - (PEAK_FALL_PER_SECOND * elapsed) / 1000;
  return { position: Math.max(position, fallen), at: peak.at };
}

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
