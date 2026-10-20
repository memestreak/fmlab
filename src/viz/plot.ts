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
  /**
   * Lights what is drawn from here on with the canvas's `--plot-glow`, as
   * a VFD's segments glow (the sandbox's envelope, key scaling and pitch
   * graphs); nothing where the canvas has none. Called after the area
   * fills, which do not glow.
   */
  glow: () => void;
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
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  const style = getComputedStyle(canvas);
  return {
    ctx,
    token: name => style.getPropertyValue(name).trim(),
    dpr,
    glow: () => {
      const colour = style.getPropertyValue('--plot-glow').trim();
      if (!colour) return;
      ctx.shadowColor = colour;
      ctx.shadowBlur = 4;
    },
    ...plotArea(width, height),
  };
}

/** A half-pixel centre, which keeps a one-pixel line sharp. */
const crisp = (v: number) => Math.round(v) + 0.5;

/** The y pixel for an amplitude, the plot area running from -1 to 1. */
export function ampToY({ top, bottom }: Area, amp: number): number {
  return (top + bottom) / 2 - (amp * (bottom - top)) / 2;
}

/** The y pixel for a share of the plot's height, 0 at the bottom, 1 at the top. */
export function shareToY({ top, bottom }: Area, share: number): number {
  return bottom - share * (bottom - top);
}

/** A horizontal line of the frame, with or without a number beside it. */
export interface Row {
  /** How far up the plot area, 0 at the bottom to 1 at the top. */
  share: number;
  /** The number at its left-hand end, if it has one. */
  label?: string;
  /** The axis itself, drawn in --rule where the rest are --grid. */
  axis?: boolean;
}

/** Amplitude from -1 to 1 about a zero axis: the waveform and the spectra. */
const AMPLITUDE_ROWS: Row[] = [
  { share: 0, label: '−1' },
  { share: 0.25 },
  { share: 0.5, label: '0', axis: true },
  { share: 0.75 },
  { share: 1, label: '1' },
];

/** A level from 0 to 1 standing on its axis: an envelope. */
export const LEVEL_ROWS: Row[] = [
  { share: 0, label: '0', axis: true },
  { share: 0.5 },
  { share: 1, label: '1' },
];

/**
 * The frame every plot stands in: horizontal gridlines and an axis, mono
 * numbers on both axes and a title under the x axis.
 *
 * The x axis has two rows of numbers: each tick's label in carrier units,
 * and under it the same place in Hz or ms. The second row's labels are
 * wider, so on a narrow canvas only every second or third is drawn.
 *
 * @param ticks the x axis's ticks, evenly spaced
 * @param x the x pixel for a tick's position
 * @param rows the horizontal lines; amplitude from -1 to 1 unless given
 */
export function drawFrame(
  plot: Plot,
  ticks: Tick[],
  x: (at: number) => number,
  xTitle: string,
  rows: Row[] = AMPLITUDE_ROWS,
): void {
  const { ctx, token, left, right, bottom } = plot;

  ctx.lineWidth = 1;
  // The axis last, so it lies over a gridline that shares its place.
  const order = (row: Row) => (row.axis ? 1 : 0);
  for (const row of [...rows].sort((a, b) => order(a) - order(b))) {
    const y = crisp(shareToY(plot, row.share));
    ctx.strokeStyle = token(row.axis ? '--rule' : '--grid');
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  // All ink: numbers in mono, the title in sans.
  ctx.fillStyle = token('--ink');
  ctx.font = `${LABEL_SIZE}px ${token('--font-mono')}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const row of rows) {
    if (row.label) ctx.fillText(row.label, left - 8, shareToY(plot, row.share));
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

  // Where the canvas's --plot-title is "hover" (the sandbox's spectrum),
  // its frame shows the title only under the pointer, so the canvas leaves
  // the title's line blank and hands the frame the text.
  const frame = ctx.canvas.parentElement;
  if (token('--plot-title') === 'hover' && frame) {
    frame.dataset.xTitle = xTitle;
    return;
  }
  ctx.font = `${LABEL_SIZE}px ${token('--font-sans')}`;
  ctx.fillText(xTitle, (left + right) / 2, bottom + 44);
}
