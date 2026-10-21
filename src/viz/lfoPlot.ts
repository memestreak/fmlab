// The LFO tab's drawing: what the voice's LFO does in the two seconds
// after a key goes down. Flat through the delay (shaded, as the envelope
// view shades its hold), fading in, then the wave at its speed, from -1
// to 1. Still: it does not move while notes sound. The swing is lit full
// while the LFO is heard, the mod wheel's depth counted, and at about half
// while its depth is 0.

import { type Dx7Lfo, lfoDepths, lfoOn } from '../dsp/dx7';
import { delayGain, heldValue, nextRandom, SYNC_PHASE, waveAt } from '../dsp/lfo';
import { beginPlot, drawValueStrip, type ScreenValue, VALUE_BAND } from './plot';

/** How long the drawing shows, in seconds from the key. */
export const LFO_SECONDS = 2;

/** Space round the drawing for its numbers, in CSS pixels. */
const MARGIN = { top: 6, right: 6, bottom: 18 + VALUE_BAND, left: 24 };

/**
 * The LFO's swing, -1 to 1, `time` seconds after a key goes down: the
 * wave from where key sync starts it (half a cycle in; without sync it
 * could be anywhere, so the drawing starts it there too), times the
 * delay's fade. A sample and hold draws msfa's values from the start.
 */
export function lfoAt(lfo: Dx7Lfo, time: number): number {
  const phase = SYNC_PHASE + lfo.speed * time;
  let held = heldValue(0);
  if (lfo.wave === 'sampleHold') {
    let r = 0;
    for (let cycle = 0; cycle < Math.floor(phase); cycle++) r = nextRandom(r);
    held = heldValue(r);
  }
  return (2 * waveAt(lfo.wave, phase, held) - 1) * delayGain(lfo.delay, time);
}

/**
 * Draws `lfo` over two seconds in `canvas`, the knobs' `values` at its
 * foot, with the mod wheel at `wheel` (0 to 1).
 */
export function drawLfo(
  canvas: HTMLCanvasElement,
  lfo: Dx7Lfo,
  values?: readonly ScreenValue[],
  wheel = 0,
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { token, glow } = plot;
  let { ctx } = plot;
  const { width, height } = canvas.getBoundingClientRect();
  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const top = MARGIN.top;
  const bottom = height - MARGIN.bottom;
  const x = (t: number) => left + ((right - left) * t) / LFO_SECONDS;
  const y = (v: number) => (top + bottom) / 2 - ((bottom - top) / 2) * v;

  // The delay, shaded: the LFO held back.
  if (lfo.delay > 0) {
    ctx.fillStyle = token('--paper-sunken');
    ctx.fillRect(left, top, x(Math.min(LFO_SECONDS, lfo.delay)) - left, bottom - top);
  }
  ctx = glow();

  // The rows at 1, 0 and -1, numbered at the left; the seconds under.
  ctx.lineWidth = 1;
  ctx.font = `11px ${token('--font-mono')}`;
  ctx.fillStyle = token('--ink');
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of [1, 0, -1]) {
    const at = Math.round(y(v)) + 0.5;
    ctx.strokeStyle = token(v === 0 ? '--rule' : '--grid');
    ctx.beginPath();
    ctx.moveTo(left, at);
    ctx.lineTo(right, at);
    ctx.stroke();
    ctx.fillText(v === -1 ? '−1' : String(v), left - 5, at);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // From half a second: the key's line marks 0.
  for (let t = 0.5; t <= LFO_SECONDS; t += 0.5) {
    ctx.fillText(`${t} s`, Math.min(right - 12, x(t)), bottom + 4);
  }

  // The key, ruled at the start.
  ctx.strokeStyle = token('--ink');
  ctx.beginPath();
  ctx.moveTo(Math.round(left) + 0.5, top);
  ctx.lineTo(Math.round(left) + 0.5, bottom);
  ctx.stroke();

  // The swing, a point a pixel: a square's and a saw's jumps drawn upright.
  ctx.strokeStyle = token('--ink');
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = lfoOn(lfo, wheel) ? 1 : 0.45;
  ctx.beginPath();
  const steps = Math.max(2, Math.round((right - left) * 2));
  for (let i = 0; i <= steps; i++) {
    const t = (LFO_SECONDS * i) / steps;
    const px = x(t);
    const py = y(lfoAt(lfo, t));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (values) drawValueStrip(plot, width, height, values);
}

/** What the drawing shows, in words, with the mod wheel at `wheel`. */
export function describeLfo(lfo: Dx7Lfo, wave: string, wheel = 0): string {
  const delay = lfo.delay > 0 ? `held back ${lfo.delay.toFixed(2)} s after each key, then faded in` : 'no delay';
  const { vibrato, tremolo } = lfoDepths(lfo, wheel);
  const depth = `vibrato ${Number(vibrato.toPrecision(3))} cents and tremolo ${Number(tremolo.toPrecision(3))} dB`;
  const withWheel = wheel > 0 ? ' with the mod wheel' : '';
  return `The LFO over two seconds after a key: ${wave.toLowerCase()} at ${lfo.speed.toFixed(2)} Hz, ${delay}; ${depth}${withWheel}.`;
}
