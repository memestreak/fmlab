// The numbers under the plots' x axes. Each tick has two labels: its place
// in carrier units, which is what the theory is written in, and the same
// place in real units (Hz or ms), which depends on the carrier.

export interface Tick {
  /** Position along the axis, in the axis's own units. */
  at: number;
  /** The label in carrier units. */
  label: string;
  /** The same position in Hz or ms. */
  sub: string;
}

/** How many numbers the spectrum's frequency axis carries. */
const SPECTRUM_TICKS = 8;

/**
 * A frequency short enough for an axis: 55.0, 446, 1.76k, 14.1k, 113k.
 * Three significant figures, never more than five characters.
 */
export function formatHz(hz: number): string {
  if (hz < 99.95) return hz.toFixed(1);
  if (hz < 999.5) return hz.toFixed(0);
  if (hz < 9995) return `${(hz / 1000).toFixed(2)}k`;
  if (hz < 99950) return `${(hz / 1000).toFixed(1)}k`;
  return `${(hz / 1000).toFixed(0)}k`;
}

/** A time in milliseconds to three significant figures: 0, 2.27, 18.2. */
export function formatMs(ms: number): string {
  if (ms === 0) return '0';
  return ms < 9.995 ? ms.toFixed(2) : ms.toFixed(1);
}

/**
 * Ticks for a frequency axis running from 0 to `maxFreq` carriers: eight
 * of them, evenly spaced, the last at the end. Zero gets none; nothing is
 * ever drawn there.
 */
export function spectrumTicks(maxFreq: number, carrierHz: number): Tick[] {
  const ticks: Tick[] = [];
  for (let i = 1; i <= SPECTRUM_TICKS; i++) {
    const at = (i * maxFreq) / SPECTRUM_TICKS;
    ticks.push({ at, label: String(at), sub: formatHz(at * carrierHz) });
  }
  return ticks;
}

/** Ticks for a time axis: one at the start of each carrier cycle. */
export function waveformTicks(cycles: number, carrierHz: number): Tick[] {
  const ticks: Tick[] = [];
  for (let cycle = 0; cycle <= cycles; cycle++) {
    ticks.push({
      at: cycle,
      label: String(cycle),
      sub: formatMs((cycle * 1000) / carrierHz),
    });
  }
  return ticks;
}

/**
 * Which labels to keep when they are too wide to all fit: every
 * `stride`-th, counted so the last one, the end of the axis, is always
 * among them.
 *
 * @param widest the widest label, in pixels
 * @param spacing the distance between neighbouring ticks, in pixels
 * @param gap the least clear space wanted between two labels
 */
export function labelStride(widest: number, spacing: number, gap: number): number {
  return Math.max(1, Math.ceil((widest + gap) / spacing));
}

/** Whether tick `i` of `count` keeps its label at that stride. */
export function keepsLabel(i: number, count: number, stride: number): boolean {
  return (count - 1 - i) % stride === 0;
}
