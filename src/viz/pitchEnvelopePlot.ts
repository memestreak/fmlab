// The Pitch EG tab's drawing: the voice's pitch envelope, drawn as the
// operator envelope view draws an operator's. Each part has a slot of its
// own and ends as far into it as its glide takes on a log scale (a glide
// takes its distance over its speed). Pitch up the side, symmetric about
// the note (0, ruled in ink), out to the largest bend, in cents under a
// semitone and semitones from one up. The parts named A, D1, D2, S and R;
// key down, held and up marked; a dot at the start and at the end of each
// part, which drag up and down for pitch. Still: no playhead.

import { type Dx7PitchEnvelope, glideSeconds, PITCH_ENVELOPE_CENTS } from '../dsp/dx7';
import { beginPlot } from './plot';
import { type EnvelopeArea, SLOTS, timePosition } from './voiceEnvelopePlot';

/** The dots to drag: the start, and each part's end but the release's (back at the start). */
export type PitchDot = 'start' | 'peak' | 'brk' | 'sustain';

/** The gridline steps, in cents, the scale picks from. */
const STEPS = [10, 25, 50, 100, 200, 300, 600, 1200, 2400] as const;

/**
 * The drawing's scale: how many cents each way from the note, and the
 * gridlines' step. It fits the envelope: out to its largest bend, never
 * under a semitone, rounded up to a whole number of steps, two at most.
 */
export function pitchScale(env: Dx7PitchEnvelope): { reach: number; step: number } {
  const largest = Math.max(100, ...[env.start, env.peak, env.brk, env.sustain].map(Math.abs));
  const step = STEPS.find(s => largest / s <= 2) ?? STEPS[STEPS.length - 1];
  return { reach: Math.min(PITCH_ENVELOPE_CENTS.max, Math.ceil(largest / step) * step), step };
}

/** The drawing's margins: room for the pitch labels and the part names. */
export function pitchArea(width: number, height: number): EnvelopeArea {
  return { left: 56, right: width - 12, top: 18, bottom: height - 18 };
}

/** Where each dot is and the corners the curve is drawn through, at a scale of `reach` cents. */
export function pitchGeometry(env: Dx7PitchEnvelope, area: EnvelopeArea, reach: number) {
  const span = area.right - area.left;
  const x = (slot: readonly [number, number], seconds: number) =>
    area.left + span * (slot[0] + (slot[1] - slot[0]) * timePosition(seconds));
  const middle = (area.top + area.bottom) / 2;
  const half = (area.bottom - area.top) / 2;
  const y = (cents: number) => middle - (Math.max(-reach, Math.min(reach, cents)) / reach) * half;
  const dots: Record<PitchDot, { x: number; y: number }> = {
    start: { x: area.left, y: y(env.start) },
    peak: { x: x(SLOTS.attack, glideSeconds(env.start, env.peak, env.attack)), y: y(env.peak) },
    brk: { x: x(SLOTS.decay1, glideSeconds(env.peak, env.brk, env.decay1)), y: y(env.brk) },
    sustain: { x: x(SLOTS.decay2, glideSeconds(env.brk, env.sustain, env.decay2)), y: y(env.sustain) },
  };
  // Held at the sustain to the end of its slot, then let go, back to the start.
  const held = { x: area.left + span * SLOTS.sustain[1], y: dots.sustain.y };
  const end = { x: x(SLOTS.release, glideSeconds(env.sustain, env.start, env.release)), y: y(env.start) };
  const corners = [dots.start, dots.peak, dots.brk, dots.sustain, held, end, { x: area.right, y: end.y }];
  return { dots, corners, held, y };
}

/** The pitch, in cents, a dot dragged to `y` sets, at a scale of `reach` cents. */
export function pitchDragged(area: EnvelopeArea, reach: number, y: number): number {
  const middle = (area.top + area.bottom) / 2;
  const half = (area.bottom - area.top) / 2;
  const cents = Math.round(((middle - y) / half) * reach);
  return Math.max(PITCH_ENVELOPE_CENTS.min, Math.min(PITCH_ENVELOPE_CENTS.max, cents));
}

/** The dot nearest (x, y) within `reach` pixels, if any. */
export function pitchDotAt(
  env: Dx7PitchEnvelope,
  area: EnvelopeArea,
  scale: number,
  x: number,
  y: number,
  reach = 12,
): PitchDot | null {
  const { dots } = pitchGeometry(env, area, scale);
  let best: PitchDot | null = null;
  let nearest = reach + 1e-9;
  // On a tie the earlier dot wins: a flat envelope's dots all sit at its
  // start, and the start is the one to take.
  for (const [name, at] of Object.entries(dots) as [PitchDot, { x: number; y: number }][]) {
    const d = Math.hypot(at.x - x, at.y - y);
    if (d < nearest) {
      nearest = d;
      best = name;
    }
  }
  return best;
}

/**
 * Draws a pitch envelope at a scale of `reach` cents (gridlines every
 * `step`, named by `label`) in `pen`, the dot `active` filled.
 */
export function drawPitchEnvelope(
  canvas: HTMLCanvasElement,
  env: Dx7PitchEnvelope,
  pen: string,
  scale: { reach: number; step: number },
  label: (cents: number) => string,
  active: PitchDot | null = null,
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token } = plot;
  const { width, height } = canvas.getBoundingClientRect();
  const area = pitchArea(width, height);
  const { dots, corners, held, y } = pitchGeometry(env, area, scale.reach);
  const ink = token('--ink');
  const colour = token(pen);
  const span = area.right - area.left;

  // The sustain's slot, shaded: where the pitch sits while the key is held.
  ctx.fillStyle = token('--paper-sunken');
  ctx.fillRect(dots.sustain.x, area.top, held.x - dots.sustain.x, area.bottom - area.top);

  // The gridlines and their pitches; the note itself, 0, in ink.
  ctx.font = `11px ${token('--font-mono')}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;
  for (let cents = -scale.reach; cents <= scale.reach; cents += scale.step) {
    const at = Math.round(y(cents)) + 0.5;
    ctx.strokeStyle = token(cents === 0 ? '--ink' : '--grid');
    ctx.beginPath();
    ctx.moveTo(area.left, at);
    ctx.lineTo(area.right, at);
    ctx.stroke();
    // Every gridline named, or every other where they crowd.
    const crowded = (area.bottom - area.top) / ((2 * scale.reach) / scale.step) < 16;
    if (!crowded || (cents / scale.step) % 2 === 0) {
      ctx.fillStyle = ink;
      ctx.fillText(label(cents), area.left - 5, at);
    }
  }

  // The parts' names over their slots.
  ctx.fillStyle = ink;
  ctx.font = `600 11px ${token('--font-sans')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const names: [string, readonly [number, number]][] = [
    ['A', SLOTS.attack],
    ['D1', SLOTS.decay1],
    ['D2', SLOTS.decay2],
    ['S', SLOTS.sustain],
    ['R', SLOTS.release],
  ];
  for (const [name, [from, to]] of names) {
    ctx.fillText(name, area.left + span * ((from + to) / 2), area.top - 6);
  }
  // Where the key goes down, is held and comes up.
  ctx.font = `italic 11px ${token('--font-sans')}`;
  ctx.textAlign = 'left';
  ctx.fillText('key down', area.left, area.bottom + 14);
  const room = held.x - dots.sustain.x - 6;
  if (ctx.measureText('key held').width <= room) {
    ctx.textAlign = 'center';
    ctx.fillText('key held', (dots.sustain.x + held.x) / 2, area.bottom + 14);
  }
  ctx.textAlign = 'left';
  const up = 'key up →';
  ctx.fillText(up, Math.min(held.x + 4, width - ctx.measureText(up).width - 1), area.bottom + 14);
  ctx.strokeStyle = ink;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(Math.round(held.x) + 0.5, area.top);
  ctx.lineTo(Math.round(held.x) + 0.5, area.bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  corners.forEach((corner, i) => (i === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y)));
  ctx.stroke();

  for (const [name, at] of Object.entries(dots) as [PitchDot, { x: number; y: number }][]) {
    ctx.beginPath();
    ctx.arc(at.x, at.y, 6, 0, 2 * Math.PI);
    ctx.fillStyle = name === active ? colour : token('--paper');
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ink;
    ctx.stroke();
  }
}

/** The envelope in words, for whoever cannot see the curve. */
export function describePitchEnvelope(
  env: Dx7PitchEnvelope,
  bend: (cents: number) => string,
  speed: (centsPerSecond: number) => string,
): string {
  return (
    `Pitch envelope: starts at ${bend(env.start)}, to ${bend(env.peak)} at ${speed(env.attack)}, ` +
    `to the break at ${bend(env.brk)} at ${speed(env.decay1)}, to sustain at ${bend(env.sustain)} ` +
    `at ${speed(env.decay2)}; let go, back to the start at ${speed(env.release)}.`
  );
}
