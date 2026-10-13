// What every plot shares: sizing the bitmap, reading the tokens, and the
// frame of gridlines and number labels round the plot area.

import { keepsLabel, labelStride, type Tick } from './ticks';

/** Space around the plot area for the axis labels, in CSS pixels. */
const MARGIN = { top: 12, right: 22, bottom: 62, left: 40 };
export const LABEL_SIZE = 12;
/** The least clear space between two labels in the second row. */
const LABEL_GAP = 8;

/** The part of a canvas the curves are drawn in, in CSS pixels. */
export interface Area {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The plot area of a canvas of a given size. On its own so that pointer
 * code can turn a position into a value without a canvas to hand.
 */
export function plotArea(width: number, height: number): Area {
  return {
    left: MARGIN.left,
    right: width - MARGIN.right,
    top: MARGIN.top,
    bottom: height - MARGIN.bottom,
  };
}

/** A canvas ready to draw on, in CSS pixels, with its plot area. */
export interface Plot extends Area {
  ctx: CanvasRenderingContext2D;
  /** Reads a CSS variable, such as `--pen-blue`, from the canvas. */
  token: (name: string) => string;
  /** Device pixels per CSS pixel. */
  dpr: number;
}

/**
 * Sizes the bitmap to the canvas's CSS box times the device pixel ratio,
 * clears it, and scales the context so drawing is in CSS pixels. Colours
 * and fonts come from the canvas's CSS variables each time, so drawing
 * again after a theme change repaints in the new theme. Null when the
 * canvas cannot be drawn on (no 2D context, or not laid out yet).
 */
export function beginPlot(canvas: HTMLCanvasElement): Plot | null {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas.getBoundingClientRect();
  if (!ctx || width === 0 || height === 0) return null;

  const dpr = window.devicePixelRatio || 1;
  // Only when it has changed: setting a canvas's size throws its bitmap
  // away, which an animated figure would otherwise do sixty times a second.
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const style = getComputedStyle(canvas);
  return {
    ctx,
    token: name => style.getPropertyValue(name).trim(),
    dpr,
    ...plotArea(width, height),
  };
}

/** A half-pixel centre, which keeps a one-pixel line sharp. */
const crisp = (v: number) => Math.round(v) + 0.5;

/** The y pixel for an amplitude, the plot area running from -1 to 1. */
export function ampToY({ top, bottom }: Area, amp: number): number {
  return (top + bottom) / 2 - (amp * (bottom - top)) / 2;
}

/**
 * The frame both plots stand in: amplitude from -1 to 1 with gridlines at
 * the halves, a zero axis, mono numbers on both axes and a title under the
 * x axis.
 *
 * The x axis has two rows of numbers: each tick's label in carrier units,
 * and under it the same place in Hz or ms. The second row's labels are
 * wider, so on a narrow canvas only every second or third is drawn.
 *
 * @param ticks the x axis's ticks, evenly spaced
 * @param x the x pixel for a tick's position
 */
export function drawFrame(
  plot: Plot,
  ticks: Tick[],
  x: (at: number) => number,
  xTitle: string,
): void {
  const { ctx, token, left, right, bottom } = plot;

  const hLine = (amp: number, colour: string) => {
    const y = crisp(ampToY(plot, amp));
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  for (const amp of [-1, -0.5, 0.5, 1]) hLine(amp, token('--grid'));
  hLine(0, token('--rule'));

  // All ink: numbers in mono, the title in sans.
  ctx.fillStyle = token('--ink');
  ctx.font = `${LABEL_SIZE}px ${token('--font-mono')}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const amp of [-1, 0, 1]) {
    // A real minus sign, as wide as the digits.
    const label = String(amp).replace('-', '−');
    ctx.fillText(label, left - 8, ampToY(plot, amp));
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  for (const { at, label } of ticks) ctx.fillText(label, x(at), bottom + 6);

  const widest = Math.max(...ticks.map(tick => ctx.measureText(tick.sub).width));
  const spacing = ticks.length > 1 ? x(ticks[1].at) - x(ticks[0].at) : Infinity;
  const stride = labelStride(widest, spacing, LABEL_GAP);
  ticks.forEach(({ at, sub }, i) => {
    if (keepsLabel(i, ticks.length, stride)) ctx.fillText(sub, x(at), bottom + 23);
  });

  ctx.font = `${LABEL_SIZE}px ${token('--font-sans')}`;
  ctx.fillText(xTitle, (left + right) / 2, bottom + 44);
}
