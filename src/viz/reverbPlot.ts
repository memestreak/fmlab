// The Reverb tab's screen (Jeremy, 2026-10-22): the plate's response to a
// click, as two decay curves, its lows lit full and its highs at about
// half, so it shows what every dial does: Decay the slope, Mix the start,
// Tone the gap between the two, Pre-delay where they start. Level in dB
// up the left, 0 to -72; time from the key along the foot. A dashed
// marker at -60 dB under the start, at the Decay set. Still: it does not
// move while notes sound. The curves are worked out off the main thread
// (dsp/reverbResponse.ts); this only draws them.

import { mixGains } from '../dsp/plateReverb';
import { type BandEnvelopes, fromStart } from '../dsp/reverbResponse';
import { beginPlot, drawValueStrip, type ScreenValue, VALUE_BAND } from './plot';

/** The level axis's foot, in dB. */
export const REVERB_FLOOR_DB = -72;
/** Space round the drawing for its numbers, in CSS pixels. */
const MARGIN = { top: 6, right: 6, bottom: 18 + VALUE_BAND, left: 30 };
/** Everything but the frame, drawn this bright while the reverb is off. */
const OFF_ALPHA = 0.45;

/** What the screen shows: the settings as they are. */
export interface ReverbView {
  on: boolean;
  /** The -60 dB time, in seconds. */
  seconds: number;
  /** 0 to 100. */
  mix: number;
  tone: number;
  /** In seconds. */
  preDelay: number;
}

/** The curves, and the time their points cover (they are worked out for a Decay). */
export interface ReverbCurves extends BandEnvelopes {
  span: number;
}

/** The time axis's length: 1.25 times the decay, and the pre-delay. */
export const reverbSpan = (view: Pick<ReverbView, 'seconds' | 'preDelay'>) => 1.25 * view.seconds + view.preDelay;

/** A round step for the time ticks: about four to six of them in `span` seconds. */
export function timeStep(span: number): number {
  const steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
  return steps.find(step => span / step <= 6) ?? 10;
}

/** A time tick's label: "0.5 s", "2 s". */
export const formatTick = (t: number) => `${Number(t.toFixed(2))} s`;

/** The wet's level in dB for a mix, or null when there is none. */
export function wetDb(mix: number): number | null {
  const { wet } = mixGains(mix);
  return wet > 0 ? 20 * Math.log10(wet) : null;
}

/** A gain as the screen writes it: "0 dB", "-6.0 dB", "-14 dB", or "off". */
export function formatGain(gain: number): string {
  if (gain <= 0) return 'off';
  const db = 20 * Math.log10(gain);
  if (Math.abs(db) < 0.05) return '0 dB';
  return `${Math.abs(db) < 10 ? db.toFixed(1) : Math.round(db)} dB`;
}

/** When a curve, set against its start, first passes `db` under it, in seconds into its span; null if it never does. */
export function timeAt(curve: Float32Array, span: number, db: number): number | null {
  const relative = fromStart(curve, span);
  const at = relative.findIndex(value => value <= db);
  return at < 0 ? null : (at * span) / relative.length;
}

/** Draws the Reverb tab's screen: `curves` (the last worked out; null before any), `view`, the knobs' `values`. */
export function drawReverb(
  canvas: HTMLCanvasElement,
  curves: ReverbCurves | null,
  view: ReverbView,
  values?: readonly ScreenValue[],
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { token, glow } = plot;
  const ctx = glow();
  const { width, height } = canvas.getBoundingClientRect();
  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const top = MARGIN.top;
  const bottom = height - MARGIN.bottom;
  const span = reverbSpan(view);
  const x = (t: number) => left + ((right - left) * t) / span;
  const y = (db: number) => top + ((bottom - top) * Math.min(-REVERB_FLOOR_DB, -db)) / -REVERB_FLOOR_DB;

  // The rows every 12 dB, numbered every 24; the seconds under.
  ctx.lineWidth = 1;
  ctx.font = `11px ${token('--font-mono')}`;
  ctx.fillStyle = token('--ink');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let db = 0; db >= REVERB_FLOOR_DB; db -= 12) {
    const at = Math.round(y(db)) + 0.5;
    ctx.strokeStyle = token(db === REVERB_FLOOR_DB ? '--rule' : '--grid');
    ctx.beginPath();
    ctx.moveTo(left, at);
    ctx.lineTo(right, at);
    ctx.stroke();
    if (db % 24 === 0) ctx.fillText(db === 0 ? '0' : `−${-db}`, left - 5, at);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = timeStep(span);
  for (let t = step; t <= span + 1e-9; t += step) ctx.fillText(formatTick(t), Math.min(right - 14, x(t)), bottom + 4);
  // The key, ruled at the start.
  ctx.strokeStyle = token('--ink');
  ctx.beginPath();
  ctx.moveTo(Math.round(left) + 0.5, top);
  ctx.lineTo(Math.round(left) + 0.5, bottom);
  ctx.stroke();

  // From here, all of it dimmed while the reverb is off.
  ctx.globalAlpha = view.on ? 1 : OFF_ALPHA;
  const start = wetDb(view.mix);

  // The pre-delay's end, dotted.
  if (view.preDelay > 0) {
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = token('--grid');
    const at = Math.round(x(view.preDelay)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(at, top);
    ctx.lineTo(at, bottom);
    ctx.stroke();
    ctx.restore();
  }

  // The decay marker: -60 dB under the start, at the Decay set.
  if (start !== null) {
    const level = start - 60;
    const at = x(view.preDelay + view.seconds);
    const markY = y(level);
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = token('--ink');
    ctx.beginPath();
    if (level >= REVERB_FLOOR_DB) {
      ctx.moveTo(left, markY);
      ctx.lineTo(at, markY);
    } else {
      ctx.moveTo(at, bottom);
    }
    ctx.lineTo(at, bottom);
    ctx.stroke();
    ctx.restore();
    if (level >= REVERB_FLOOR_DB) {
      ctx.fillStyle = token('--ink');
      ctx.beginPath();
      ctx.arc(at, markY, 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = `10px ${token('--font-mono')}`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`−60 dB at ${formatTick(Number(view.seconds.toFixed(1)))}`, at - 6, markY + 3);
    }
  }

  // The two curves, each from the wet's level at its own start, ending
  // where they pass the floor; the lows lit full, the highs at half.
  if (curves && start !== null) {
    const bands: [Float32Array, string, string, boolean][] = [
      [curves.lows, '--pen-blue', 'LOWS', true],
      [curves.highs, '--pen-green', 'HIGHS', false],
    ];
    for (const [curve, pen, name, above] of bands) {
      const relative = fromStart(curve, curves.span);
      ctx.strokeStyle = token(pen);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let label: { px: number; py: number } | null = null;
      let drawn = false;
      for (let i = 0; i < relative.length; i++) {
        const db = start + relative[i];
        const t = view.preDelay + (i * curves.span) / relative.length;
        if (t > span || !(db >= REVERB_FLOOR_DB)) {
          // Down to the floor where it passes it, then no further.
          if (drawn && db < REVERB_FLOOR_DB && t <= span) ctx.lineTo(x(t), y(REVERB_FLOOR_DB));
          break;
        }
        if (drawn) ctx.lineTo(x(t), y(db));
        else ctx.moveTo(x(t), y(db));
        drawn = true;
        if (!label && relative[i] <= -30) label = { px: x(t), py: y(db) };
      }
      ctx.stroke();
      if (label) {
        ctx.fillStyle = token(pen);
        ctx.font = `600 9px ${token('--font-sans')}`;
        ctx.textAlign = above ? 'left' : 'right';
        ctx.textBaseline = above ? 'bottom' : 'top';
        ctx.fillText(name, label.px + (above ? 4 : -4), label.py + (above ? -3 : 3));
      }
    }
  }

  // Dry and wet at the top right, and OFF beside them while it is off.
  ctx.globalAlpha = 1;
  ctx.fillStyle = token('--ink');
  ctx.font = `10px ${token('--font-mono')}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  const { dry, wet } = mixGains(view.mix);
  let textRight = right - 4;
  if (!view.on) {
    ctx.font = `600 10px ${token('--font-mono')}`;
    ctx.fillText('OFF', textRight, top + 3);
    textRight -= ctx.measureText('OFF').width + 12;
    ctx.font = `10px ${token('--font-mono')}`;
  }
  ctx.globalAlpha = view.on ? 1 : OFF_ALPHA;
  ctx.fillText(`DRY ${formatGain(dry)}   WET ${formatGain(wet)}`, textRight, top + 3);
  ctx.globalAlpha = 1;
  if (values) drawValueStrip(plot, width, height, values);
}

/** What the screen shows, in words. */
export function describeReverb(view: ReverbView, curves: ReverbCurves | null): string {
  if (!view.on) return 'Reverb off';
  const after = view.preDelay > 0 ? ` after ${Math.round(view.preDelay * 1000)} ms` : '';
  const { dry, wet } = mixGains(view.mix);
  const gains = `dry ${formatGain(dry)}, wet ${formatGain(wet)}`;
  let highs = '';
  if (curves && wet > 0) {
    const lows = timeAt(curves.lows, curves.span, -40);
    const high = timeAt(curves.highs, curves.span, -40);
    if (lows !== null && high !== null) {
      const word = Math.abs(high - lows) <= 0.1 * lows ? 'about as fast as' : high < lows ? 'faster than' : 'slower than';
      highs = `; the highs fall ${word} the lows`;
    }
  }
  return `Reverb on: falls 60 dB in ${formatTick(Number(view.seconds.toFixed(1)))}${after}${highs}; ${gains}.`;
}
