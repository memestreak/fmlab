import { type Envelope, envelopeAt, noteSeconds } from '../dsp/envelope';
import {
  ATTACK,
  clamp,
  DECAY,
  envelopeOf,
  INDEX,
  indexAtTime,
  type LabState,
  RELEASE,
  SUSTAIN,
} from '../model/lab';
import {
  type Area,
  beginPlot,
  drawFrame,
  LEVEL_ROWS,
  type Plot,
  plotArea,
  shareToY,
} from './plot';
import { noteAxisEnd, secondsTicks } from './ticks';

/** The dots that can be dragged, by what they set. */
export type HandleId = 'attack' | 'sustain' | 'release';

/** Radius of a handle's dot. */
const HANDLE_RADIUS = 5.5;
/** A pointer within this many pixels of a handle has hold of it. */
const HANDLE_REACH = 18;

/** How long the time axis is for a state's note, in seconds. */
export function envelopeSpan(state: LabState): number {
  return noteAxisEnd(noteSeconds(envelopeOf(state)));
}

/**
 * Where each handle sits: a time in seconds and a level from 0 to 1.
 *
 * - attack: the top of the rise. Moving it sideways sets the attack.
 * - sustain: where the decay has settled. Sideways sets the decay, up and
 *   down the sustain level.
 * - release: where the note has died away. Sideways sets the release.
 */
export function handles(
  envelope: Envelope,
): Record<HandleId, { time: number; level: number }> {
  const { attack, decay, sustain, release, hold } = envelope;
  return {
    attack: { time: attack, level: 1 },
    sustain: { time: attack + decay, level: sustain },
    release: { time: hold + release, level: 0 },
  };
}

/** A point of the plot area as a time and a level, and back. */
function toPoint(area: Area, span: number, px: number, py: number) {
  return {
    time: ((px - area.left) / (area.right - area.left)) * span,
    level: (area.bottom - py) / (area.bottom - area.top),
  };
}

function toPixels(area: Area, span: number, time: number, level: number) {
  return {
    x: area.left + (Math.min(time, span) / span) * (area.right - area.left),
    y: shareToY(area, level),
  };
}

/**
 * The handle a pointer at (px, py) has hold of, on a canvas of that size
 * showing `state`: the nearest one within reach, or null.
 */
export function handleAt(
  state: LabState,
  width: number,
  height: number,
  px: number,
  py: number,
): HandleId | null {
  const area = plotArea(width, height);
  const span = envelopeSpan(state);
  let best: HandleId | null = null;
  let bestDistance = HANDLE_REACH;
  for (const [id, at] of Object.entries(handles(envelopeOf(state)))) {
    const { x, y } = toPixels(area, span, at.time, at.level);
    const distance = Math.hypot(x - px, y - py);
    if (distance <= bestDistance) {
      best = id as HandleId;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * What dragging a handle to (px, py) sets, each value held inside its
 * slider's range. The pointer can only reach times on the axis, so a drag
 * never makes a note longer than the axis; the sliders can.
 */
export function dragHandle(
  state: LabState,
  id: HandleId,
  width: number,
  height: number,
  px: number,
  py: number,
): Partial<LabState> {
  const area = plotArea(width, height);
  const span = envelopeSpan(state);
  const point = toPoint(area, span, px, py);
  // A captured pointer can be dragged past the edge of the plot; the time
  // it stands for stops at the edge, or the axis would grow under it.
  const time = Math.min(span, Math.max(0, point.time));
  const { level } = point;
  // Hundredths of a second, and of the level: what the readouts show.
  const round = (value: number) => Math.round(value * 100) / 100;
  switch (id) {
    case 'attack':
      return { attack: clamp(round(time), ATTACK) };
    case 'sustain':
      return {
        decay: clamp(round(time - state.attack), DECAY),
        sustain: clamp(round(level), SUSTAIN),
      };
    case 'release':
      return { release: clamp(round(time - state.hold), RELEASE) };
  }
}

function trace(plot: Plot, span: number, level: (time: number) => number): void {
  const { ctx, left, right, dpr } = plot;
  const count = Math.ceil((right - left) * dpr);
  ctx.beginPath();
  for (let i = 0; i <= count; i++) {
    const time = (i / count) * span;
    const x = left + (i / count) * (right - left);
    const y = shareToY(plot, level(time));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/**
 * Draws a note's envelope over its length: the loudness in --pen-blue,
 * and over it, thinner and dashed, the index in --pen-green as a share of
 * the largest index there is (the scale on the right). Three ink dots are
 * the handles, and a faint upright rule marks where the note is let go.
 *
 * With a `time` in seconds on the page's clock, an ink line shows how far
 * through the last note that moment is.
 */
export function drawEnvelope(
  state: LabState,
  canvas: HTMLCanvasElement,
  time?: number,
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token, left, right, top, bottom } = plot;
  const envelope = envelopeOf(state);
  const span = envelopeSpan(state);
  const x = (seconds: number) => left + (seconds / span) * (right - left);

  drawFrame(plot, secondsTicks(span), x, 'time, in seconds', LEVEL_ROWS);

  // The index's scale, on the right, in ink like every number.
  ctx.fillStyle = token('--ink');
  ctx.font = `12px ${token('--font-mono')}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(INDEX.max), right + 4, shareToY(plot, 1));

  // Where the note is let go.
  if (envelope.hold < span) {
    const holdX = Math.round(x(envelope.hold)) + 0.5;
    ctx.strokeStyle = token('--rule');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(holdX, top);
    ctx.lineTo(holdX, bottom);
    ctx.stroke();
  }

  ctx.lineJoin = 'round';
  ctx.strokeStyle = token('--pen-blue');
  ctx.lineWidth = 2.5;
  trace(plot, span, seconds => envelopeAt(envelope, seconds));

  ctx.strokeStyle = token('--pen-green');
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  trace(plot, span, seconds => indexAtTime(state, seconds) / INDEX.max);
  ctx.setLineDash([]);

  // The handles: paper dots ringed in ink, so they read on either line.
  ctx.fillStyle = token('--paper');
  ctx.strokeStyle = token('--ink');
  ctx.lineWidth = 2;
  for (const at of Object.values(handles(envelope))) {
    const dot = toPixels(plot, span, at.time, at.level);
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, HANDLE_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }

  drawPlayhead(plot, state, span, time);
}

/**
 * An upright ink line at how far through the last note `time` is, if it
 * is still sounding. Shared with the spectrogram, which has the same time
 * axis.
 */
export function drawPlayhead(
  plot: Plot,
  state: LabState,
  span: number,
  time: number | undefined,
): void {
  const into = noteProgress(state, time);
  if (into === null || into > span) return;
  const { ctx, token, left, right, top, bottom } = plot;
  const lineX = Math.round(left + (into / span) * (right - left)) + 0.5;
  ctx.strokeStyle = token('--ink');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lineX, top);
  ctx.lineTo(lineX, bottom);
  ctx.stroke();
}

/**
 * How many seconds into the last note the moment `time` is, on the page's
 * clock; null when no note is sounding then (none yet, not started, or
 * over).
 */
export function noteProgress(
  state: LabState,
  time: number | undefined,
): number | null {
  if (time === undefined || state.noteStartedAt === null) return null;
  const into = time - state.noteStartedAt;
  if (into < 0 || into > noteSeconds(envelopeOf(state))) return null;
  return into;
}
