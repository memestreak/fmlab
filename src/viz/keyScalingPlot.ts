// "Across the keyboard": how an operator's level changes from key to key
// with its keyboard level scaling, drawn small over a strip of keys with
// the break point ruled. In the sandbox's operator table.

import { type Dx7Operator, levelScalingDb, SCALING_DEPTH } from '../dsp/dx7';
import { beginPlot } from './plot';

/** The keys drawn: the keyboard's lowest C to its highest. */
export const FIRST_KEY = 24;
export const LAST_KEY = 108;
/** The strip of keys along the bottom, in CSS pixels. */
const KEYS_HEIGHT = 7;
/** How far up and down the curve may go, in dB from the operator's level. */
export const SHOWN_DB = 24;

/** The key under an x position on a canvas `width` wide. */
export function keyAtX(width: number, x: number): number {
  const key = FIRST_KEY + ((LAST_KEY - FIRST_KEY) * x) / Math.max(1, width);
  return Math.round(Math.min(LAST_KEY, Math.max(FIRST_KEY, key)));
}

/** The x position of a key. */
export function xOfKey(width: number, key: number): number {
  return ((key - FIRST_KEY) / (LAST_KEY - FIRST_KEY)) * width;
}

/** Where the curve sits: its middle line (no change) and how tall a dB is. */
function scale(height: number) {
  const top = 2;
  const bottom = height - KEYS_HEIGHT - 2;
  return { middle: top + (bottom - top) * 0.3, perDb: (bottom - top) / (SHOWN_DB * 1.4), top, bottom };
}

/**
 * The depth one side of the scaling needs for its curve to reach the
 * height (y) dragged to at the end of that side, held inside the range.
 */
export function depthAt(
  op: Pick<Dx7Operator, 'breakKey' | 'left' | 'right'>,
  side: 'left' | 'right',
  height: number,
  y: number,
): number {
  const { middle, perDb } = scale(height);
  const want = (middle - y) / perDb;
  const end = side === 'left' ? FIRST_KEY : LAST_KEY;
  const unit = levelScalingDb(
    { ...op, left: { ...op.left, depth: 1 }, right: { ...op.right, depth: 1 } },
    end,
  );
  if (unit === 0) return 0;
  const depth = want / unit;
  return Number(Math.min(SCALING_DEPTH.max, Math.max(SCALING_DEPTH.min, depth)).toFixed(2));
}

/** Draws an operator's level across the keyboard in `pen`. */
export function drawKeyScaling(canvas: HTMLCanvasElement, op: Dx7Operator, pen: string): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token } = plot;
  const { width, height } = canvas.getBoundingClientRect();
  const { middle, perDb, top, bottom } = scale(height);

  // The keys, white with the black ones marked, along the bottom.
  const keysTop = height - KEYS_HEIGHT;
  ctx.fillStyle = token('--paper');
  ctx.fillRect(0, keysTop, width, KEYS_HEIGHT);
  ctx.strokeStyle = token('--rule');
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, keysTop + 0.5, width - 1, KEYS_HEIGHT - 1);
  ctx.fillStyle = token('--ink');
  for (let key = FIRST_KEY; key <= LAST_KEY; key++) {
    if ([1, 3, 6, 8, 10].includes(key % 12)) {
      ctx.fillRect(xOfKey(width, key) - 0.5, keysTop, 1.2, KEYS_HEIGHT * 0.6);
    }
  }

  // The operator's own level, unscaled: a faint line.
  ctx.strokeStyle = token('--rule');
  ctx.beginPath();
  ctx.moveTo(0, Math.round(middle) + 0.5);
  ctx.lineTo(width, Math.round(middle) + 0.5);
  ctx.stroke();

  // The break point, ruled in ink.
  const breakX = Math.round(xOfKey(width, op.breakKey)) + 0.5;
  ctx.strokeStyle = token('--ink');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(breakX, top);
  ctx.lineTo(breakX, height);
  ctx.stroke();

  // The level at every key.
  ctx.strokeStyle = token(pen);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let key = FIRST_KEY; key <= LAST_KEY; key++) {
    const db = Math.max(-SHOWN_DB, Math.min(SHOWN_DB * 0.4, levelScalingDb(op, key)));
    const y = Math.min(bottom, Math.max(top, middle - db * perDb));
    const x = xOfKey(width, key);
    if (key === FIRST_KEY) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** What the curve shows, in words, for whoever cannot see it. */
export function describeKeyScaling(op: Dx7Operator, name: (key: number) => string): string {
  const side = (s: 'left' | 'right', end: number) => {
    const { curve, depth } = op[s];
    if (depth === 0) return `${s === 'left' ? 'below' : 'above'} it, no change`;
    const db = levelScalingDb(op, end);
    return `${s === 'left' ? 'below' : 'above'} it ${db > 0 ? 'louder' : 'quieter'}, ${Math.abs(db).toFixed(1)} dB by ${name(end)}, ${curve === 'lin' ? 'linear' : 'exponential'}`;
  };
  return `Break point ${name(op.breakKey)}; ${side('left', FIRST_KEY)}; ${side('right', LAST_KEY)}.`;
}
