// The sandbox's knobs show their values on the screen above them, not
// under their names (Jeremy, 2026-10-20): each value is drawn in the
// screen's foot, over its dial. The knob keeps its readout, hidden, and
// it is that text the screen writes, so the two cannot disagree.

import type { ScreenValue } from '../viz/plot';

/**
 * The values of the knobs in `row`, each at its dial's centre in
 * `canvas`'s CSS pixels, on the line of its row of knobs where they wrap.
 * A knob without a dial (the curve buttons) has none. Empty while either
 * is not laid out.
 */
export function knobValues(canvas: HTMLCanvasElement, row: HTMLElement): ScreenValue[] {
  const box = canvas.getBoundingClientRect();
  if (box.width === 0) return [];
  const found = [...row.querySelectorAll<HTMLElement>('.knob')].flatMap(knob => {
    const dial = knob.querySelector('.knob-dial');
    const text = knob.querySelector('.knob-readout')?.textContent;
    if (!dial || !text) return [];
    const at = dial.getBoundingClientRect();
    if (at.width === 0) return [];
    return [{ x: at.left + at.width / 2 - box.left, text, top: Math.round(at.top) }];
  });
  const tops = [...new Set(found.map(value => value.top))].sort((a, b) => a - b);
  return found.map(({ x, text, top }) => ({ x, text, line: Math.min(1, tops.indexOf(top)) }));
}

/** Calls `draw` again whenever the knobs' row is laid out anew. */
export function redrawOnLayout(row: HTMLElement, draw: () => void): void {
  new ResizeObserver(() => draw()).observe(row);
}
