// Key scaling: how an operator's level changes from key to key
// with its level scaling (the DX7's "keyboard level scaling"), drawn over
// a strip of keys with the break point ruled. Small and unlabelled in the
// sandbox's operator table; large, with its dB and its keys named, in the
// operator panel's Key scaling tab.

import { type Dx7Operator, levelScalingDb, SCALING_DEPTH } from '../dsp/dx7';
import { type Area, beginPlot } from './plot';

/** The keys drawn: a piano's 88, A0 to C8. */
export const FIRST_KEY = 21;
export const LAST_KEY = 108;
/** The strip of keys along the bottom of the small drawing, in CSS pixels. */
const KEYS_HEIGHT = 7;
/** The large drawing's strip, and the line of key names under it. */
const LARGE_KEYS_HEIGHT = 16;
const KEY_NAMES_HEIGHT = 16;
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

/**
 * Where a drawing puts things: the curve's area (its x running from the
 * lowest key to the highest), and the strip of keys under it. The large
 * one leaves room at the left for its dB and under the strip for the
 * keys' names.
 */
export interface KeysArea extends Area {
  keysTop: number;
  keysHeight: number;
}

export function keysArea(width: number, height: number, large = false): KeysArea {
  if (!large) {
    return { left: 0, right: width, top: 2, bottom: height - KEYS_HEIGHT - 2, keysTop: height - KEYS_HEIGHT, keysHeight: KEYS_HEIGHT };
  }
  const keysTop = height - KEY_NAMES_HEIGHT - LARGE_KEYS_HEIGHT;
  return { left: 34, right: width - 6, top: 16, bottom: keysTop - 4, keysTop, keysHeight: LARGE_KEYS_HEIGHT };
}

/** The x of a key in an area. */
export function keyX(area: Area, key: number): number {
  return area.left + xOfKey(area.right - area.left, key);
}

/** The key under an x in an area. */
export function keyAt(area: Area, x: number): number {
  return keyAtX(area.right - area.left, x - area.left);
}

/** Where the curve sits: its middle line (no change) and how tall a dB is. */
function scale({ top, bottom }: Area) {
  return { middle: top + (bottom - top) * 0.3, perDb: (bottom - top) / (SHOWN_DB * 1.4) };
}

/**
 * The depth one side of the scaling needs for its curve to reach the
 * height (y) dragged to at the end of that side, held inside the range.
 * `height` is the small drawing's, or an area is given.
 */
export function depthAt(
  op: Pick<Dx7Operator, 'breakKey' | 'left' | 'right'>,
  side: 'left' | 'right',
  height: number | Area,
  y: number,
): number {
  const area = typeof height === 'number' ? keysArea(0, height) : height;
  const { middle, perDb } = scale(area);
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

/**
 * Draws an operator's level across the keyboard in `pen`. Large, with
 * `name` writing a key's name: the dB ruled at the left, the break
 * point's key over its line, and the Cs under the keys.
 */
export function drawKeyScaling(
  canvas: HTMLCanvasElement,
  op: Dx7Operator,
  pen: string,
  large?: { name: (key: number) => string },
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token } = plot;
  const { width, height } = canvas.getBoundingClientRect();
  const area = keysArea(width, height, Boolean(large));
  const { left, right, top, bottom, keysTop, keysHeight } = area;
  const { middle, perDb } = scale(area);
  const x = (key: number) => keyX(area, key);
  const yOf = (db: number) => middle - db * perDb;

  // The keys, white with the black ones marked, along the bottom.
  ctx.fillStyle = token('--paper');
  ctx.fillRect(left, keysTop, right - left, keysHeight);
  ctx.strokeStyle = token('--rule');
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, keysTop + 0.5, right - left - 1, keysHeight - 1);
  ctx.fillStyle = token('--ink');
  for (let key = FIRST_KEY; key <= LAST_KEY; key++) {
    if ([1, 3, 6, 8, 10].includes(key % 12)) {
      ctx.fillRect(x(key) - 0.5, keysTop, large ? 2 : 1.2, keysHeight * 0.6);
    } else if (large && key % 12 === 0) {
      // Each C's left edge, and its name under the strip.
      ctx.fillRect(Math.round(x(key)), keysTop, 1, keysHeight);
    }
  }

  if (large) {
    ctx.font = `11px ${token('--font-mono')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let key = 24; key <= LAST_KEY; key += 12) {
      ctx.fillText(large.name(key), x(key), keysTop + keysHeight + 3);
    }
    // The dB, every 12, either side of the operator's own level.
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = token('--grid');
    for (const db of [6, -6, -12, -18]) {
      const at = Math.round(yOf(db)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(left, at);
      ctx.lineTo(right, at);
      ctx.stroke();
      if (db % 12 === 0) ctx.fillText(String(db), left - 5, at);
    }
    ctx.fillText('0', left - 5, yOf(0));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('dB', 2, 10);
  }

  // The operator's own level, unscaled: a faint line.
  ctx.strokeStyle = token('--rule');
  ctx.beginPath();
  ctx.moveTo(left, Math.round(middle) + 0.5);
  ctx.lineTo(right, Math.round(middle) + 0.5);
  ctx.stroke();

  // The break point, ruled in ink, its key named over it when large. One
  // above C8 is ruled at the right-hand end.
  const breakX = Math.round(x(Math.min(LAST_KEY, op.breakKey))) + 0.5;
  ctx.strokeStyle = token('--ink');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(breakX, top);
  ctx.lineTo(breakX, keysTop + keysHeight);
  ctx.stroke();
  if (large) {
    ctx.fillStyle = token('--ink');
    ctx.font = `600 11px ${token('--font-sans')}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`break ${large.name(op.breakKey)}`, Math.min(right - 30, Math.max(left + 30, breakX)), top - 3);
  }

  // The level at every key.
  ctx.strokeStyle = token(pen);
  ctx.lineWidth = large ? 2 : 1.5;
  ctx.beginPath();
  for (let key = FIRST_KEY; key <= LAST_KEY; key++) {
    const db = Math.max(-SHOWN_DB, Math.min(SHOWN_DB * 0.4, levelScalingDb(op, key)));
    const y = Math.min(bottom, Math.max(top, yOf(db)));
    if (key === FIRST_KEY) ctx.moveTo(x(key), y);
    else ctx.lineTo(x(key), y);
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
