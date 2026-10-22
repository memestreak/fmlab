import {
  fmSpectrum,
  type SpectralLine,
  trueFmSpectrum,
} from '../dsp/fmSpectrum';
import {
  CARRIER_HZ,
  carsonBand,
  dx7KernelLevelsAt,
  dx7NoteOf,
  highlightOf,
  type LabState,
  momentOf,
  noteProgress,
  operatorLevelsAt,
  patchOf,
} from '../model/lab';
import { kernelSpectrum, operatorSpectrum } from '../dsp/operators';
import {
  ampToY,
  beginPlot,
  drawFrame,
  LABEL_SIZE,
  type Plot,
  plotArea,
  shareToY,
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
  if (state.mode === 'ops') return operatorsAxisEnd(state);
  if (state.compare) {
    // Chapter 9's two spectra share one axis, wide enough for either: the
    // frequency-modulated one's index is index / ratio.
    const { ratio, index } = state;
    return Math.max(axisEnd(ratio, index), axisEnd(ratio, index / ratio));
  }
  const { ratio, index } = patchOf(state);
  return state.realUnits
    ? hzAxisEnd(ratio, index) / state.carrierHz
    : axisEnd(ratio, index);
}

/** The last answer of operatorsAxisEnd, and the patch it was for. */
let lastAxis = { key: '', end: 0 };

/**
 * Where the frequency axis should end for six operators: past the highest
 * partial that matters (a hundredth of the loudest) when every operator is
 * at its full level, rounded up to the same fixed ends as `axisEnd`. It
 * holds still through a note, as levels fall. Remembered, since working
 * out the spectrum is not free.
 */
export function operatorsAxisEnd(state: LabState): number {
  const key = JSON.stringify(
    state.voiceModel === 'dx7'
      ? [state.algorithm, state.dxOperators, state.dxFeedback, state.carrierHz]
      : [state.algorithm, state.operators, state.feedback],
  );
  if (key !== lastAxis.key) {
    const lines = spectrumOf({ ...state, noteStartedAt: null });
    const loudest = Math.max(0, ...lines.map(line => line.amp));
    const highest = Math.max(1, ...lines.filter(line => line.amp >= loudest / 100).map(line => line.freq));
    const end = AXIS_ENDS.find(end => end >= highest * 1.05) ?? AXIS_ENDS[AXIS_ENDS.length - 1];
    lastAxis = { key, end };
  }
  return lastAxis.end;
}

/**
 * The DX7 voice's spectrum between notes, last worked out, and what the
 * kernel was given for it.
 */
let lastSteady: { key: number[]; lines: SpectralLine[] } | null = null;

/** While a note sounds, its predicted lines are worked out at most this often, in seconds. */
export const SOUNDING_REFRESH = 0.1;
/** ... or when an operator's level has moved by more than this many dB since. */
export const SOUNDING_DB = 0.5;

/**
 * The sounding note's spectrum, last worked out: when (on the page's
 * clock), what of the kernel's input stays put through a note (algorithm,
 * feedback, ratios) and its levels then.
 */
let lastSounding: { at: number; fixed: number[]; levels: number[]; lines: SpectralLine[] } | null = null;

/**
 * Whether the sounding note's lines worked out at `at` for `levels` still
 * do at `time` for `now`: within SOUNDING_REFRESH of then, or every
 * operator's level within SOUNDING_DB of what it was (a held sustain).
 * Levels below silence's floor count as equal.
 */
export function soundingLinesHold(at: number, levels: readonly number[], time: number, now: readonly number[]): boolean {
  if (time >= at && time - at < SOUNDING_REFRESH) return true;
  return now.every((level, op) => {
    const was = Math.abs(levels[op]);
    const is = Math.abs(level);
    if (was < 1e-5 && is < 1e-5) return true;
    if (was < 1e-5 || is < 1e-5) return false;
    return Math.abs(20 * Math.log10(is / was)) <= SOUNDING_DB;
  });
}

/**
 * The patch's line spectrum, by whichever kind of modulation it uses. For
 * a patch that plays notes, `time` makes it the note at that moment: that
 * moment's index, with every line scaled by that moment's loudness.
 */
export function spectrumOf(state: LabState, time?: number): SpectralLine[] {
  if (state.mode === 'ops' && state.voiceModel === 'dx7') {
    // Between notes the voice's spectrum is the same until its patch or
    // key changes, and it is asked for three times a frame (the stems,
    // the axis, the description): worked out once. It runs the kernel and
    // a transform, which a knob turned at sixty frames a second felt.
    // Keyed on what the kernel is given, not on the operators: turning an
    // envelope knob changes the operators but not the steady sound.
    const note = dx7NoteOf(state);
    const levels = dx7KernelLevelsAt(state, time);
    const steady = noteProgress(state, time) === null;
    const key = [state.algorithm, note.feedback, ...note.ratios, ...levels];
    if (steady && lastSteady && key.every((value, i) => value === lastSteady?.key[i])) return lastSteady.lines;
    // While a note sounds (16,384 samples of the kernel and a transform, a
    // few ms, every frame otherwise): the last lines, until 100 ms have
    // passed and a level has moved by half a dB. The measured trace is
    // drawn every frame regardless; only the stems lag, by at most that.
    const fixed = key.slice(0, 2 + note.ratios.length);
    if (
      !steady &&
      time !== undefined &&
      lastSounding &&
      fixed.every((value, i) => value === lastSounding?.fixed[i]) &&
      soundingLinesHold(lastSounding.at, lastSounding.levels, time, levels)
    ) {
      return lastSounding.lines;
    }
    const lines = kernelSpectrum(state.algorithm, note.ratios, levels, note.feedback);
    if (steady) lastSteady = { key, lines };
    else if (time !== undefined) lastSounding = { at: time, fixed, levels, lines };
    return lines;
  }
  if (state.mode === 'ops') {
    return operatorSpectrum(
      state.algorithm,
      state.operators.map(op => op.ratio),
      operatorLevelsAt(state, time),
      state.feedback,
    );
  }
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
  if (isLogSpectrum(state)) return drawLogSpectrum(state, canvas, time);
  const plot = beginPlot(canvas);
  if (!plot) return spectrumOf(state, time);
  plot.glow();
  const x = drawSpectrumFrame(plot, state);
  return drawPredicted(plot, state, x, time);
}

/**
 * Draws the predicted line spectrum's stems, and the extras the state
 * asks for (harmonic lines, Carson's bracket), into a frame already
 * drawn. Returns the lines drawn.
 */
export function drawPredicted(
  plot: Plot,
  state: LabState,
  x: (freq: number) => number,
  time?: number,
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

/*
 * The sandbox's spectrum (Jeremy, 2026-10-22: "it needs a non-linear
 * x-axis"): frequency in Hz on a log axis fixed from 20 Hz to 20 kHz,
 * the same for every voice and key, so the partials move when another key
 * is played and spread evenly by octave; and level in dB, 0 dB at the
 * top to DB_FLOOR at the foot, so quiet partials and a note's decay show.
 * The chapters keep their axes.
 */

/**
 * What the analyser measured (liveSpectrum.ts): dB per bin, and the bin's
 * amplitude on the stems' scale, where a full sine reads 1.
 */
export interface Measured {
  db: Float32Array;
  sampleRate: number;
  fftSize: number;
  amplitude: (db: number) => number;
}

/** The log frequency axis's ends, in Hz. */
export const LOG_HZ = { min: 20, max: 20000 } as const;
/** The foot of the dB axis: lines quieter than this are not drawn. */
export const DB_FLOOR = -72;
/** A gridline every this many dB. */
const DB_STEP = 12;
/** The least clear space between two of the frequency axis's labels. */
const LOG_LABEL_GAP = 6;
/** The foot's margin with one row of numbers. */
const LOG_BOTTOM = 22;

/** Whether the state's spectrum is drawn on the log axes: the sandbox's. */
export function isLogSpectrum(state: LabState): boolean {
  return state.chapter === 'sandbox';
}

/**
 * The lines the sandbox's spectrum draws at `time`: the note sounding
 * then, and nothing while none does (Jeremy, 2026-10-22: it showed the
 * voice at rest on load, until the first note). The chapters draw the
 * patch at rest instead.
 */
export function heardLines(state: LabState, time?: number): SpectralLine[] {
  return noteProgress(state, time) === null ? [] : spectrumOf(state, time);
}

/** How far along the log axis a frequency in Hz is: 0 at 20 Hz, 1 at 20 kHz. */
export function hzToShare(hz: number): number {
  return Math.log(hz / LOG_HZ.min) / Math.log(LOG_HZ.max / LOG_HZ.min);
}

/** An amplitude's size in dB; a full sine (1) is 0 dB, nothing -Infinity. */
export function ampDb(amp: number): number {
  const size = Math.abs(amp);
  return size > 0 ? 20 * Math.log10(size) : -Infinity;
}

/**
 * How far up the dB axis a level is: 1 at 0 dB (and above, held there),
 * 0 at the floor; null below the floor, where nothing is drawn.
 */
export function dbToShare(db: number): number | null {
  if (!(db >= DB_FLOOR)) return null;
  return Math.min(1, (db - DB_FLOOR) / -DB_FLOOR);
}

/** The log axis's ticks: 20, 50, 100, 200, 500, 1k, 2k, 5k, 10k, 20k. */
export const LOG_HZ_TICKS: readonly { hz: number; label: string }[] = [
  20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000,
].map(hz => ({ hz, label: hz >= 1000 ? `${hz / 1000}k` : String(hz) }));

/**
 * Which labels to keep where they would touch: from the left, each one
 * whose box clears the last kept by `gap`; the last label is kept over the
 * one before it. `xs` are the labels' centres, `widths` their widths.
 */
export function keptLabels(xs: readonly number[], widths: readonly number[], gap: number): boolean[] {
  const kept = xs.map(() => false);
  let edge = -Infinity;
  xs.forEach((x, i) => {
    if (x - widths[i] / 2 >= edge + gap) {
      kept[i] = true;
      edge = x + widths[i] / 2;
    }
  });
  const last = xs.length - 1;
  if (last > 0 && !kept[last]) {
    // The top of the axis, 20k, matters more than the one before it.
    for (let i = last - 1; i >= 0; i--) {
      if (!kept[i]) continue;
      kept[i] = false;
      const before = kept.lastIndexOf(true, i - 1);
      const clear = before < 0 || xs[last] - widths[last] / 2 >= xs[before] + widths[before] / 2 + gap;
      kept[last] = clear;
      if (clear) break;
    }
  }
  return kept;
}

/** The dB gridlines, 0 at the top to the floor, each with its label. */
const DB_ROWS = Array.from({ length: -DB_FLOOR / DB_STEP + 1 }, (_, i) => -i * DB_STEP);

/**
 * Draws the log axes' frame on the sandbox's spectrum: the dB gridlines,
 * labelled where there is room (every other where they are close), the
 * floor as the axis, faint uprights at the frequency ticks and their
 * numbers. Returns the x pixel for a frequency in Hz and the y pixel for
 * a level in dB (null below the floor).
 */
function drawLogFrame(plot: Plot): { x: (hz: number) => number; y: (db: number) => number | null } {
  const { ctx, token, left, right, bottom } = plot;
  const x = (hz: number) => left + hzToShare(hz) * (right - left);
  const y = (db: number) => {
    const share = dbToShare(db);
    return share === null ? null : shareToY(plot, share);
  };
  const crisp = (v: number) => Math.round(v) + 0.5;
  ctx.lineWidth = 1;
  ctx.strokeStyle = token('--grid');
  for (const { hz } of LOG_HZ_TICKS) {
    const at = crisp(x(hz));
    ctx.beginPath();
    ctx.moveTo(at, plot.top);
    ctx.lineTo(at, bottom);
    ctx.stroke();
  }
  for (const db of DB_ROWS) {
    const at = crisp(y(db) ?? bottom);
    ctx.strokeStyle = token(db === DB_FLOOR ? '--rule' : '--grid');
    ctx.beginPath();
    ctx.moveTo(left, at);
    ctx.lineTo(right, at);
    ctx.stroke();
  }
  ctx.fillStyle = token('--ink');
  ctx.font = `${LABEL_SIZE}px ${token('--font-mono')}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  const rowGap = (bottom - plot.top) / (DB_ROWS.length - 1);
  const every = rowGap >= LABEL_SIZE + 2 ? 1 : 2;
  DB_ROWS.forEach((db, i) => {
    if (i % every === 0) ctx.fillText(db === 0 ? '0' : `−${-db}`, left - 6, y(db) ?? bottom);
  });
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const xs = LOG_HZ_TICKS.map(tick => x(tick.hz));
  const widths = LOG_HZ_TICKS.map(tick => ctx.measureText(tick.label).width);
  const kept = keptLabels(xs, widths, LOG_LABEL_GAP);
  LOG_HZ_TICKS.forEach((tick, i) => {
    if (kept[i]) ctx.fillText(tick.label, xs[i], bottom + 6);
  });
  return { x, y };
}

/**
 * Draws the sandbox's spectrum on the log axes: the note sounding's
 * predicted lines (none when no note sounds) as stems standing up from the floor by their level in dB (a negative one
 * in --pen-red, ending in a hollow marker), and, while sound plays, the
 * measured spectrum over them, the same axes. Returns the lines.
 */
export function drawLogSpectrum(
  state: LabState,
  canvas: HTMLCanvasElement,
  time?: number,
  measured?: Measured,
): SpectralLine[] {
  const lines = heardLines(state, time);
  const plot = beginPlot(canvas);
  if (!plot) return lines;
  // One row of numbers under the axis, not two: the plot takes the rest.
  plot.bottom = canvas.getBoundingClientRect().height - LOG_BOTTOM;
  plot.glow();
  const { x, y } = drawLogFrame(plot);
  const { ctx, token, bottom } = plot;
  for (const { freq, amp } of lines) {
    const hz = freq * state.carrierHz;
    if (hz < LOG_HZ.min || hz > LOG_HZ.max) continue;
    const top = y(ampDb(amp));
    if (top === null || bottom - top < MIN_STEM) continue;
    const negative = amp < 0;
    ctx.lineWidth = STEM_WIDTH;
    ctx.strokeStyle = token(negative ? '--pen-red' : '--pen-blue');
    ctx.beginPath();
    ctx.moveTo(x(hz), bottom);
    ctx.lineTo(x(hz), top);
    ctx.stroke();
    if (negative) {
      ctx.fillStyle = token('--paper');
      ctx.beginPath();
      ctx.arc(x(hz), top, MARKER_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (measured) logTrace(plot, measured, x, y);
  return lines;
}

/**
 * The measured spectrum on the log axes: each bin from 20 Hz to 20 kHz at
 * its own frequency and level (a full sine reads 0 dB, as the stems do),
 * joined bin to bin, nothing smoothed between them; below the floor, on
 * it. Filled down to the floor.
 */
function logTrace(
  plot: Plot,
  { db, sampleRate, fftSize, amplitude }: Measured,
  x: (hz: number) => number,
  y: (db: number) => number | null,
): void {
  const { ctx, base, token, bottom } = plot;
  const points: [number, number][] = [];
  for (let bin = 1; bin < db.length; bin++) {
    const hz = (bin * sampleRate) / fftSize;
    if (hz < LOG_HZ.min) continue;
    if (hz > LOG_HZ.max) break;
    points.push([x(hz), y(ampDb(amplitude(db[bin]))) ?? bottom]);
  }
  if (points.length < 2) return;
  base.save();
  base.beginPath();
  base.moveTo(points[0][0], bottom);
  for (const [px, py] of points) base.lineTo(px, py);
  base.lineTo(points[points.length - 1][0], bottom);
  base.closePath();
  base.globalAlpha = 0.18;
  base.fillStyle = token('--pen-blue');
  base.fill();
  base.restore();
  ctx.beginPath();
  points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = token('--pen-blue');
  ctx.stroke();
}
