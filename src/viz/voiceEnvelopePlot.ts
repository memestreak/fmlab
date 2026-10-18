// The sandbox's envelope drawings: an operator's DX7 envelope, large in
// the envelope view (with its dots to drag) and small in each row of the
// operator table. Level in dB up the side; along the bottom each part has
// a slot of its own, and its end sits in the slot as far as its time is
// on a log scale, so a 2 ms attack and a 4 s decay are both visible and a
// dot holds still under the pointer as it is dragged.

import { type Dx7Envelope, MAX_STAGE_SECONDS, SILENCE_DB } from '../dsp/dx7';
import { beginPlot } from './plot';

/** The parts in the order drawn, with each one's slot, 0 to 1 across. */
export const SLOTS = {
  attack: [0, 0.14],
  decay1: [0.14, 0.38],
  decay2: [0.38, 0.62],
  sustain: [0.62, 0.78],
  release: [0.78, 1],
} as const;

/** The shortest time the log scale shows; anything shorter is at its start. */
const SHORTEST = 0.001;

/** How far into its slot a time puts a part's end, 0 to 1. */
export function timePosition(seconds: number): number {
  if (seconds <= SHORTEST) return 0;
  return Math.min(1, Math.log(seconds / SHORTEST) / Math.log(MAX_STAGE_SECONDS / SHORTEST));
}

/** The time at a position in a slot, 0 to 1. */
export function timeAt(position: number): number {
  const p = Math.min(1, Math.max(0, position));
  return SHORTEST * (MAX_STAGE_SECONDS / SHORTEST) ** p;
}

/** Where the drawing goes in a canvas, in CSS pixels. */
export interface EnvelopeArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The large drawing's margins: room for the dB labels and the part names. */
export function largeArea(width: number, height: number): EnvelopeArea {
  return { left: 34, right: width - 12, top: 22, bottom: height - 20 };
}

/** The small drawing fills its canvas, with a pixel to spare. */
export function smallArea(width: number, height: number): EnvelopeArea {
  return { left: 1, right: width - 1, top: 2, bottom: height - 2 };
}

/** The dots to drag, one at the end of each part with a time. */
export type EnvelopeDot = 'peak' | 'brk' | 'sustain' | 'release';

/** Where each dot is, and the corners the curve is drawn through. */
export function envelopeGeometry(env: Dx7Envelope, area: EnvelopeArea) {
  const span = area.right - area.left;
  const x = (slot: readonly [number, number], seconds: number) =>
    area.left + span * (slot[0] + (slot[1] - slot[0]) * timePosition(seconds));
  const y = (db: number) =>
    area.top + ((Math.min(0, db) / SILENCE_DB) * (area.bottom - area.top));
  const dots: Record<EnvelopeDot, { x: number; y: number }> = {
    peak: { x: x(SLOTS.attack, env.attack), y: y(env.peak) },
    brk: { x: x(SLOTS.decay1, env.decay1), y: y(env.brk) },
    sustain: { x: x(SLOTS.decay2, env.decay2), y: y(env.sustain) },
    release: { x: x(SLOTS.release, env.release), y: y(SILENCE_DB) },
  };
  // Held at the sustain to the end of its slot, then let go.
  const held = { x: area.left + span * SLOTS.sustain[1], y: dots.sustain.y };
  const corners = [
    { x: area.left, y: y(SILENCE_DB) },
    dots.peak,
    dots.brk,
    dots.sustain,
    held,
    dots.release,
  ];
  return { dots, corners, held, y };
}

/** The values a dot dragged to (x, y) sets. */
export function dotDragged(
  dot: EnvelopeDot,
  area: EnvelopeArea,
  x: number,
  y: number,
): Partial<Dx7Envelope> {
  const span = area.right - area.left;
  const within = (slot: readonly [number, number]) =>
    timeAt(((x - area.left) / span - slot[0]) / (slot[1] - slot[0]));
  const db = Math.round(
    Math.min(0, Math.max(SILENCE_DB, ((y - area.top) / (area.bottom - area.top)) * SILENCE_DB)),
  );
  const time = (seconds: number) => Number(seconds.toPrecision(2));
  switch (dot) {
    case 'peak':
      return { attack: time(within(SLOTS.attack)), peak: db };
    case 'brk':
      return { decay1: time(within(SLOTS.decay1)), brk: db };
    case 'sustain':
      return { decay2: time(within(SLOTS.decay2)), sustain: db };
    case 'release':
      return { release: time(within(SLOTS.release)) };
  }
}

/** The dot nearest (x, y) within `reach` pixels, if any. */
export function dotAt(
  env: Dx7Envelope,
  area: EnvelopeArea,
  x: number,
  y: number,
  reach = 12,
): EnvelopeDot | null {
  const { dots } = envelopeGeometry(env, area);
  let best: EnvelopeDot | null = null;
  let nearest = reach;
  for (const [name, at] of Object.entries(dots) as [EnvelopeDot, { x: number; y: number }][]) {
    const d = Math.hypot(at.x - x, at.y - y);
    if (d <= nearest) {
      nearest = d;
      best = name;
    }
  }
  return best;
}

/**
 * Draws an envelope: its curve in `pen`, the sustain's slot shaded. Large,
 * it adds the dB scale, the parts' names (A, D1, D2, S, R), where the key
 * goes down, is held and comes up, and its dots, the one `active` filled.
 */
export function drawVoiceEnvelope(
  canvas: HTMLCanvasElement,
  env: Dx7Envelope,
  pen: string,
  large: boolean,
  active: EnvelopeDot | null = null,
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token } = plot;
  const { width, height } = canvas.getBoundingClientRect();
  const area = large ? largeArea(width, height) : smallArea(width, height);
  const { dots, corners, held, y } = envelopeGeometry(env, area);
  const ink = token('--ink');
  const colour = token(pen);
  const span = area.right - area.left;

  // The sustain's slot, shaded: where the note sits while the key is held.
  ctx.fillStyle = token('--paper-sunken');
  ctx.fillRect(dots.sustain.x, area.top, held.x - dots.sustain.x, area.bottom - area.top);

  if (large) {
    ctx.font = `11px ${token('--font-mono')}`;
    ctx.fillStyle = ink;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = token('--rule');
    ctx.lineWidth = 1;
    // Every 24 dB, or every 48 where the drawing is short.
    const ticks = area.bottom - area.top < 70 ? [0, -48] : [0, -24, -48, -72];
    for (const db of ticks) {
      const at = Math.round(y(db)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(area.left, at);
      ctx.lineTo(area.right, at);
      ctx.stroke();
      ctx.fillText(String(db), area.left - 5, at);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('dB', 2, 10);
    // The parts' names over their slots.
    ctx.font = `600 11px ${token('--font-sans')}`;
    ctx.textAlign = 'center';
    const names: [string, readonly [number, number]][] = [
      ['A', SLOTS.attack],
      ['D1', SLOTS.decay1],
      ['D2', SLOTS.decay2],
      ['S', SLOTS.sustain],
      ['R', SLOTS.release],
    ];
    for (const [name, [from, to]] of names) {
      ctx.fillText(name, area.left + span * ((from + to) / 2), area.top - 8);
    }
    // Where the key goes down, is held and comes up.
    ctx.font = `italic 11px ${token('--font-sans')}`;
    ctx.textAlign = 'left';
    ctx.fillText('key down', area.left, area.bottom + 15);
    // "key held" under the sustain, where there is room for it.
    const room = held.x - dots.sustain.x - 6;
    if (ctx.measureText('key held').width <= room) {
      ctx.textAlign = 'center';
      ctx.fillText('key held', (dots.sustain.x + held.x) / 2, area.bottom + 15);
    }
    ctx.textAlign = 'left';
    const up = 'key up →';
    ctx.fillText(up, Math.min(held.x + 4, width - ctx.measureText(up).width - 1), area.bottom + 15);
    ctx.strokeStyle = ink;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(Math.round(held.x) + 0.5, area.top);
    ctx.lineTo(Math.round(held.x) + 0.5, area.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = colour;
  ctx.lineWidth = large ? 2 : 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  corners.forEach((corner, i) => (i === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y)));
  ctx.stroke();

  if (large) {
    for (const [name, at] of Object.entries(dots) as [EnvelopeDot, { x: number; y: number }][]) {
      ctx.beginPath();
      ctx.arc(at.x, at.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = name === active ? colour : token('--paper');
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = ink;
      ctx.stroke();
    }
  }
}
