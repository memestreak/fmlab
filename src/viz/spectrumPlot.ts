import {
  fmSpectrum,
  type SpectralLine,
  trueFmSpectrum,
} from '../dsp/fmSpectrum';
import {
  carsonBand,
  highlightOf,
  type LabState,
  patchOf,
} from '../model/lab';
import {
  ampToY,
  beginPlot,
  drawFrame,
  LABEL_SIZE,
  type Plot,
  plotArea,
} from './plot';
import { spectrumTicks } from './ticks';

const STEM_WIDTH = 2;
/** How faint the other stems go when one order is picked out. */
const DIMMED = 0.22;
/** A pointer within this many pixels of a stem is pointing at it. */
const HIT_DISTANCE = 8;
/** How far the ends of a bracket hang down. */
const BRACKET_DROP = 7;
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
  const picked = highlightOf(state);
  for (const { freq, amp } of lines) {
    if (freq > maxFreq || Math.abs(y(amp) - y(0)) < MIN_STEM) continue;
    const negative = amp < 0;
    // With one order picked out, its pair of stems stays; the rest fade.
    const isPicked = picked !== null && sidebandOrder(freq, ratio) === picked;
    ctx.globalAlpha = picked === null || isPicked ? 1 : DIMMED;
    ctx.lineWidth = crowded ? 1 : isPicked ? STEM_WIDTH + 1 : STEM_WIDTH;
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
  ctx.globalAlpha = 1;

  if (state.showBandwidth) {
    const { low, high } = carsonBand(ratio, index);
    drawBracket(plot, x(low), x(Math.min(high, maxFreq)), "Carson's rule");
  }
  return lines;
}

/**
 * A bracket along the top of the plot from x pixel `from` to `to`, in ink,
 * with its name under its right-hand end (or its left, if that is where
 * the room is).
 */
function drawBracket(plot: Plot, from: number, to: number, name: string): void {
  const { ctx, token, top, left, right } = plot;
  const yLine = top + 1;
  ctx.strokeStyle = token('--ink');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(from, yLine + BRACKET_DROP);
  ctx.lineTo(from, yLine);
  ctx.lineTo(to, yLine);
  ctx.lineTo(to, yLine + BRACKET_DROP);
  ctx.stroke();

  ctx.fillStyle = token('--ink');
  ctx.font = `${LABEL_SIZE}px ${token('--font-sans')}`;
  ctx.textBaseline = 'top';
  const width = ctx.measureText(name).width;
  const fitsRight = to + 6 + width <= right;
  ctx.textAlign = fitsRight ? 'left' : 'right';
  const textX = fitsRight ? to + 6 : Math.max(left + width, to - 6);
  ctx.fillText(name, textX, yLine + 3);
}

/**
 * Which sideband a line is, by its frequency in carrier units: 0 for the
 * carrier, 1 for the first one either side, and so on. Only meaningful
 * where sidebands have not folded on to one another.
 */
export function sidebandOrder(freq: number, ratio: number): number {
  return Math.round(Math.abs(freq - 1) / ratio);
}

/**
 * The sideband order of the stem a pointer at x pixel `px` is on, on a
 * canvas `width` wide, or null when it is on none.
 *
 * @param maxOrder orders above this are not offered
 */
export function orderAtX(
  state: LabState,
  width: number,
  px: number,
  maxOrder: number,
): number | null {
  const { ratio, index } = patchOf(state);
  const { left, right } = plotArea(width, 0);
  const maxFreq = axisEnd(ratio, index);
  const freq = ((px - left) / (right - left)) * maxFreq;
  const order = sidebandOrder(freq, ratio);
  if (order > maxOrder) return null;

  // The nearer of the pair, and only if the pointer is close to it.
  const side = freq < 1 ? -1 : 1;
  const stemX = left + ((1 + side * order * ratio) / maxFreq) * (right - left);
  return Math.abs(stemX - px) <= HIT_DISTANCE ? order : null;
}
