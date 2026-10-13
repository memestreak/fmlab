import { fmSpectrum, type SpectralLine } from '../dsp/fmSpectrum';
import type { LabState } from '../model/lab';
import { ampToY, beginPlot, drawFrame } from './plot';

const STEM_WIDTH = 2;
/** Radius of the hollow marker on a negative stem. */
const MARKER_RADIUS = 4;
/** The frequency axis ends at one of these, in carrier units. */
const AXIS_ENDS = [8, 16, 32, 64, 128];
/** A stem shorter than this many CSS pixels is not drawn. */
const MIN_STEM = 0.5;

/**
 * Where the frequency axis should end. By Carson's rule nearly all the
 * energy lies within index + 1 sidebands of the carrier; one more is
 * allowed for, and the answer is rounded up to a fixed set of ends so the
 * axis holds still while the index moves a little.
 */
export function axisEnd(ratio: number, index: number): number {
  const needed = 1 + ratio * (index + 2);
  return AXIS_ENDS.find(end => end >= needed) ?? AXIS_ENDS[AXIS_ENDS.length - 1];
}

/**
 * Draws the patch's line spectrum as stems on a frequency axis in carrier
 * units. A positive line is a --pen-blue stem above the axis; a negative
 * one is --pen-red, below it, and ends in a hollow marker so the phase
 * does not rest on colour alone.
 *
 * Returns the lines drawn, for the figure's text description.
 */
export function drawSpectrum(
  state: LabState,
  canvas: HTMLCanvasElement,
): SpectralLine[] {
  const lines = fmSpectrum(state.ratio, state.index);
  const plot = beginPlot(canvas);
  if (!plot) return lines;
  const { ctx, token, left, right } = plot;

  const maxFreq = axisEnd(state.ratio, state.index);
  const x = (freq: number) => left + (freq / maxFreq) * (right - left);
  const y = (amp: number) => ampToY(plot, amp);

  // Eight numbers along the axis, whatever its end.
  const xTicks = [];
  for (let freq = maxFreq / 8; freq <= maxFreq; freq += maxFreq / 8) {
    xTicks.push({ label: String(freq), x: x(freq) });
  }
  drawFrame(plot, xTicks, 'frequency, in multiples of the carrier');

  ctx.lineWidth = STEM_WIDTH;
  for (const { freq, amp } of lines) {
    if (freq > maxFreq || Math.abs(y(amp) - y(0)) < MIN_STEM) continue;
    const negative = amp < 0;
    ctx.strokeStyle = token(negative ? '--pen-red' : '--pen-blue');
    ctx.beginPath();
    ctx.moveTo(x(freq), y(0));
    ctx.lineTo(x(freq), y(amp));
    ctx.stroke();
    if (negative) {
      ctx.fillStyle = token('--paper');
      ctx.beginPath();
      ctx.arc(x(freq), y(amp), MARKER_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }
  return lines;
}
