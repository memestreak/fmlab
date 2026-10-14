import {
  fmSpectrum,
  type SpectralLine,
  trueFmSpectrum,
} from '../dsp/fmSpectrum';
import {
  CARRIER_HZ,
  carsonBand,
  highlightOf,
  type LabState,
  momentOf,
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
import { hzTicks, spectrumTicks } from './ticks';

const STEM_WIDTH = 2;
/** How faint the other stems go when one order is picked out. */
const DIMMED = 0.22;
/** A pointer within this many pixels of a stem is pointing at it. */
const HIT_DISTANCE = 8;
/** Harmonic lines closer than this many pixels are not drawn. */
const MIN_HARMONIC_SPACING = 6;
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

/** A frequency axis fixed in Hz ends at one of these. */
const HZ_AXIS_ENDS = [1000, 2000, 5000, 10000, 20000, 50000, 100000];

/**
 * Where a frequency axis fixed in Hz should end: far enough for the
 * highest carrier there is, with the same allowance for sidebands as
 * `axisEnd`. It does not depend on where the carrier is now; that is the
 * point of it. A bare sine (index 0) needs no allowance, and gets 1000 Hz.
 */
export function hzAxisEnd(ratio: number, index: number): number {
  const multiples = index === 0 ? 1 : 1 + ratio * (index + 2);
  const needed = CARRIER_HZ.max * multiples;
  return (
    HZ_AXIS_ENDS.find(end => end >= needed) ??
    HZ_AXIS_ENDS[HZ_AXIS_ENDS.length - 1]
  );
}

/**
 * The right-hand end of the state's frequency axis, in carrier units,
 * whichever units the axis is numbered in.
 */
export function axisSpan(state: LabState): number {
  const { ratio, index } = patchOf(state);
  return state.realUnits
    ? hzAxisEnd(ratio, index) / state.carrierHz
    : axisEnd(ratio, index);
}

/**
 * The patch's line spectrum, by whichever kind of modulation it uses. For
 * a patch that plays notes, `time` makes it the note at that moment: that
 * moment's index, with every line scaled by that moment's loudness.
 */
export function spectrumOf(state: LabState, time?: number): SpectralLine[] {
  const { ratio } = patchOf(state);
  const { index, level } = momentOf(state, time);
  const lines =
    state.mode === 'fm' ? trueFmSpectrum(ratio, index) : fmSpectrum(ratio, index);
  return level === 1
    ? lines
    : lines.map(line => ({ freq: line.freq, amp: line.amp * level }));
}

/**
 * Draws the patch's line spectrum as stems on a frequency axis numbered in
 * carrier units and, beneath, in Hz; or, with `realUnits`, on an axis
 * fixed in Hz. A positive line is a --pen-blue stem
 * above the axis; a negative one is --pen-red, below it, and ends in a
 * hollow marker so the phase does not rest on colour alone. (True FM's
 * lines are magnitudes, so all of its stems stand above the axis.)
 *
 * Returns the lines drawn, for the figure's text description.
 */
/**
 * Draws the spectrum's frame: amplitude from -1 to 1, and the frequency
 * axis, in carrier units with Hz beneath, or with `realUnits` fixed in
 * Hz. Returns the x pixel for a frequency in carrier units. Shared by the
 * predicted and the live view, so the two line up.
 */
export function drawSpectrumFrame(
  plot: Plot,
  state: LabState,
): (freq: number) => number {
  const { left, right } = plot;
  const { ratio, index } = patchOf(state);
  const maxFreq = axisSpan(state);
  const x = (freq: number) => left + (freq / maxFreq) * (right - left);
  if (state.realUnits) {
    // Numbered in Hz and fixed, so a stem moves when the carrier does.
    drawFrame(
      plot,
      hzTicks(hzAxisEnd(ratio, index)),
      hz => x(hz / state.carrierHz),
      'frequency, in Hz',
    );
  } else {
    drawFrame(
      plot,
      spectrumTicks(maxFreq, state.carrierHz),
      x,
      'frequency: multiples of the carrier, and Hz',
    );
  }
  return x;
}

export function drawSpectrum(
  state: LabState,
  canvas: HTMLCanvasElement,
  time?: number,
): SpectralLine[] {
  const plot = beginPlot(canvas);
  if (!plot) return spectrumOf(state, time);
  const x = drawSpectrumFrame(plot, state);
  return drawPredicted(plot, state, x, time);
}

/**
 * Draws the predicted line spectrum's stems, and the extras the state
 * asks for (harmonic lines, Carson's bracket), into a frame already
 * drawn. Returns the lines drawn.
 *
 * @param opacity how strongly to draw the stems: 1, or less to keep them
 *   faint under the live view so the two can be compared
 */
export function drawPredicted(
  plot: Plot,
  state: LabState,
  x: (freq: number) => number,
  time?: number,
  opacity = 1,
): SpectralLine[] {
  const lines = spectrumOf(state, time);
  const { ctx, token, top, bottom } = plot;
  const { ratio, index } = patchOf(state);
  const maxFreq = axisSpan(state);
  const y = (amp: number) => ampToY(plot, amp);

  if (state.showHarmonics) {
    // An upright line at every whole multiple of the carrier: where the
    // harmonics of a note at the carrier's pitch would be. Left out where
    // they would be too close together to tell apart from a tint.
    const spacing = x(1) - x(0);
    if (spacing >= MIN_HARMONIC_SPACING) {
      ctx.strokeStyle = token('--grid');
      ctx.lineWidth = 1;
      for (let harmonic = 1; harmonic <= maxFreq; harmonic++) {
        const lineX = Math.round(x(harmonic)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(lineX, top);
        ctx.lineTo(lineX, bottom);
        ctx.stroke();
      }
    }
  }

  // A slow vibrato is hundreds of lines a pixel or two apart. Thin stems
  // keep them a row of lines rather than a block.
  const crowded = x(ratio) - x(0) < CROWDED_SPACING;
  const picked = highlightOf(state);
  for (const { freq, amp } of lines) {
    if (freq > maxFreq || Math.abs(y(amp) - y(0)) < MIN_STEM) continue;
    const negative = amp < 0;
    // With one order picked out, its pair of stems stays; the rest fade.
    const isPicked = picked !== null && sidebandOrder(freq, ratio) === picked;
    ctx.globalAlpha = opacity * (picked === null || isPicked ? 1 : DIMMED);
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
  const { ratio } = patchOf(state);
  const { left, right } = plotArea(width, 0);
  const maxFreq = axisSpan(state);
  const freq = ((px - left) / (right - left)) * maxFreq;
  const order = sidebandOrder(freq, ratio);
  if (order > maxOrder) return null;

  // The nearer of the pair, and only if the pointer is close to it.
  const side = freq < 1 ? -1 : 1;
  const stemX = left + ((1 + side * order * ratio) / maxFreq) * (right - left);
  return Math.abs(stemX - px) <= HIT_DISTANCE ? order : null;
}
