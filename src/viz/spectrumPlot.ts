import {
  fmSpectrum,
  type SpectralLine,
  trueFmSpectrum,
} from '../dsp/fmSpectrum';
import { type LabState, patchOf } from '../model/lab';
import { ampToY, beginPlot, drawFrame } from './plot';
import { spectrumTicks } from './ticks';

const STEM_WIDTH = 2;
/** Stems closer together than this many pixels are drawn thinner. */
const CROWDED_SPACING = 4;
/** Radius of the hollow marker on a negative stem. */
const MARKER_RADIUS = 4;
/** The frequency axis ends at one of these, in carrier units. */
const AXIS_ENDS = [2, 4, 8, 16, 32, 64, 128];
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

/** The patch's line spectrum, by whichever kind of modulation it uses. */
export function spectrumOf(state: LabState): SpectralLine[] {
  const { ratio, index } = patchOf(state);
  return state.mode === 'fm'
    ? trueFmSpectrum(ratio, index)
    : fmSpectrum(ratio, index);
}

/**
 * Draws the patch's line spectrum as stems on a frequency axis numbered in
 * carrier units and, beneath, in Hz. A positive line is a --pen-blue stem
 * above the axis; a negative one is --pen-red, below it, and ends in a
 * hollow marker so the phase does not rest on colour alone. (True FM's
 * lines are magnitudes, so all of its stems stand above the axis.)
 *
 * Returns the lines drawn, for the figure's text description.
 */
export function drawSpectrum(
  state: LabState,
  canvas: HTMLCanvasElement,
): SpectralLine[] {
  const lines = spectrumOf(state);
  const plot = beginPlot(canvas);
  if (!plot) return lines;
  const { ctx, token, left, right } = plot;
  const { ratio, index } = patchOf(state);

  const maxFreq = axisEnd(ratio, index);
  const x = (freq: number) => left + (freq / maxFreq) * (right - left);
  const y = (amp: number) => ampToY(plot, amp);

  drawFrame(
    plot,
    spectrumTicks(maxFreq, state.carrierHz),
    x,
    'frequency: multiples of the carrier, and Hz',
  );

  // A slow vibrato is hundreds of lines a pixel or two apart. Thin stems
  // keep them a row of lines rather than a block.
  const crowded = x(ratio) - x(0) < CROWDED_SPACING;
  ctx.lineWidth = crowded ? 1 : STEM_WIDTH;
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
