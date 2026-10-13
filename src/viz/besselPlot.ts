import { besselJSeries } from '../dsp/bessel';
import { highlightOf, INDEX, type LabState } from '../model/lab';
import { ampToY, type Area, beginPlot, drawFrame, plotArea } from './plot';
import type { Tick } from './ticks';

/** The curves drawn: J_0 to J_8, the carrier and eight pairs of sidebands. */
export const MAX_ORDER = 8;
/** A pointer within this many pixels of a curve is pointing at it. */
const HIT_DISTANCE = 12;
/** Radius of the dot where the index line crosses a curve. */
const DOT_RADIUS = 3.5;
/** How faint the other curves go when one is picked out. */
const DIMMED = 0.22;

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

/** "J₃": a curve's name, as it is written on the plot and its button. */
export function orderLabel(order: number): string {
  return `J${[...String(order)].map(digit => SUBSCRIPTS[Number(digit)]).join('')}`;
}

/** The x pixel for an index, across the plot area. */
function indexToX({ left, right }: Area, index: number): number {
  return left + ((index - INDEX.min) / (INDEX.max - INDEX.min)) * (right - left);
}

/**
 * The index a pointer at x pixel `px` is over, on a canvas `width` wide:
 * held inside the slider's range and rounded to hundredths.
 */
export function indexAt(width: number, px: number): number {
  const { left, right } = plotArea(width, 0);
  const share = (px - left) / (right - left);
  const index = INDEX.min + Math.min(1, Math.max(0, share)) * (INDEX.max - INDEX.min);
  return Math.round(index * 100) / 100;
}

/**
 * The curve a pointer at (px, py) is on, on a canvas of that size: the
 * order whose curve is nearest above or below, if it is close enough. Null
 * when the pointer is on none, or outside the plot.
 */
export function orderAt(
  width: number,
  height: number,
  px: number,
  py: number,
): number | null {
  const area = plotArea(width, height);
  if (px < area.left || px > area.right) return null;
  const share = (px - area.left) / (area.right - area.left);
  const values = besselJSeries(MAX_ORDER, INDEX.min + share * (INDEX.max - INDEX.min));

  let best: number | null = null;
  let bestDistance = HIT_DISTANCE;
  for (let order = 0; order <= MAX_ORDER; order++) {
    const distance = Math.abs(ampToY(area, values[order]) - py);
    if (distance <= bestDistance) {
      best = order;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Where each curve's name goes: the index of its first and highest peak.
 * J_0's is at the very start, so it is nudged in from the edge.
 */
export function labelIndex(order: number): number {
  if (order === 0) return 0.35;
  let best = 0;
  let bestValue = -Infinity;
  for (let index = 0; index <= INDEX.max; index += 0.05) {
    const value = besselJSeries(order, index)[order];
    if (value > bestValue) {
      best = index;
      bestValue = value;
    }
  }
  return best;
}

const LABEL_INDICES = Array.from({ length: MAX_ORDER + 1 }, (_, order) =>
  labelIndex(order),
);

const INDEX_TICKS: Tick[] = [0, 2, 4, 6, 8, 10].map(at => ({
  at,
  label: String(at),
  sub: '',
}));

/**
 * Draws J_0 to J_8 against the modulation index, with an upright ink line
 * at the patch's index and a dot where it crosses each curve. Those dots
 * are the heights of the spectrum's stems, which is the point of the
 * figure.
 *
 * A curve is --pen-blue. A dot is filled blue where its curve is above
 * zero and hollow --pen-red where it is below, the spectrum's own way of
 * marking a sideband that is upside down. If the state picks out one
 * order, its curve is drawn heavier and the rest fainter.
 */
export function drawBessel(state: LabState, canvas: HTMLCanvasElement): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token, left, right, top, bottom, dpr } = plot;
  const picked = highlightOf(state);
  const x = (index: number) => indexToX(plot, index);
  const y = (amp: number) => ampToY(plot, amp);

  drawFrame(plot, INDEX_TICKS, x, 'modulation index');

  // One series per device pixel column gives every curve at once.
  const columns = Math.ceil((right - left) * dpr);
  const series: Float64Array[] = [];
  for (let column = 0; column <= columns; column++) {
    const index = INDEX.min + (column / columns) * (INDEX.max - INDEX.min);
    series.push(besselJSeries(MAX_ORDER, index));
  }

  ctx.strokeStyle = token('--pen-blue');
  ctx.lineJoin = 'round';
  for (let order = 0; order <= MAX_ORDER; order++) {
    const isPicked = picked === order;
    ctx.globalAlpha = picked === null || isPicked ? 1 : DIMMED;
    ctx.lineWidth = isPicked ? 2.75 : 1.5;
    ctx.beginPath();
    for (let column = 0; column <= columns; column++) {
      const px = left + (column / columns) * (right - left);
      const py = y(series[column][order]);
      if (column === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Names, in ink, above each curve's first peak.
  ctx.fillStyle = token('--ink');
  ctx.font = `12px ${token('--font-sans')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (let order = 0; order <= MAX_ORDER; order++) {
    const at = LABEL_INDICES[order];
    const peak = besselJSeries(order, at)[order];
    ctx.globalAlpha = picked === null || picked === order ? 1 : DIMMED;
    ctx.fillText(orderLabel(order), x(at), y(peak) - 5);
  }
  ctx.globalAlpha = 1;

  // The index line, and its crossings.
  const here = besselJSeries(MAX_ORDER, state.index);
  const lineX = Math.round(x(state.index)) + 0.5;
  ctx.strokeStyle = token('--ink');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lineX, top);
  ctx.lineTo(lineX, bottom);
  ctx.stroke();

  // The index in numbers, beside the top of the line: on its right unless
  // that would run off the plot.
  const readout = String(Number(state.index.toFixed(3)));
  ctx.fillStyle = token('--ink');
  ctx.font = `12px ${token('--font-mono')}`;
  ctx.textBaseline = 'top';
  const fitsRight = lineX + 6 + ctx.measureText(readout).width <= right;
  ctx.textAlign = fitsRight ? 'left' : 'right';
  ctx.fillText(readout, fitsRight ? lineX + 6 : lineX - 6, top);

  for (let order = 0; order <= MAX_ORDER; order++) {
    const negative = here[order] < 0;
    const isPicked = picked === order;
    ctx.globalAlpha = picked === null || isPicked ? 1 : DIMMED;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = token(negative ? '--pen-red' : '--pen-blue');
    ctx.fillStyle = token(negative ? '--paper' : '--pen-blue');
    ctx.beginPath();
    ctx.arc(lineX, y(here[order]), isPicked ? DOT_RADIUS + 1.5 : DOT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
