import type { Preset } from '../chapters/types';

// The preset window's arithmetic (ui/presetPanel.ts), kept free of the
// page so it can be tested: the order the voices step in, where an arrow
// on the window's glass goes, and which bank the window opens on.

/**
 * The voice `steps` along from `at` in a list of `count`, round from the
 * last to the first and back; from no voice (-1), the first or the last.
 * The banks do not stop it (Jeremy, 2026-10-22): A32 goes on to B1, B32
 * to A1.
 */
export function stepPreset(at: number, steps: number, count: number): number {
  if (at < 0) return steps > 0 ? 0 : count - 1;
  return (((at + steps) % count) + count) % count;
}

/**
 * Where a key on the window's glass goes from voice `at`, of `count` in
 * all, the shown bank's voices `first` to `last` in columns of `rows`:
 * up and down one voice, left and right a column (keeping the row), all
 * across the banks and round the ends; Home and End the shown bank's
 * first and last. Null for any other key.
 */
export function gridMove(
  key: string,
  at: number,
  count: number,
  rows: number,
  shown: { first: number; last: number },
): number | null {
  const by = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -rows, ArrowRight: rows }[key];
  if (by !== undefined) return stepPreset(at, by, count);
  if (key === 'Home') return shown.first;
  if (key === 'End') return shown.last;
  return null;
}

/**
 * The bank the window opens on: the playing voice's (`at`), or once the
 * sound is edited (-1), the voice last chosen's.
 */
export function openingBank(presets: readonly Preset[], at: number, last: number): string | undefined {
  return presets[at >= 0 ? at : last]?.bank;
}

/** The indices, into all of `presets`, of one bank's voices, in order. */
export function bankVoices(presets: readonly Preset[], bank: string | undefined): number[] {
  return presets.flatMap((preset, i) => (preset.bank === bank ? [i] : []));
}
