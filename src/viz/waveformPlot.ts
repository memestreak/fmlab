import {
  fmSample,
  fmWindowSample,
  modulatorSample,
  sampleCycles,
  trueFmSample,
} from '../dsp/waveform';
import { type LabState, patchOf } from '../model/lab';
import { ampToY, beginPlot, drawFrame, type Plot } from './plot';
import { msTicks, type Tick, waveformTicks } from './ticks';

const TWO_PI = 2 * Math.PI;

/** The shortest stretch of signal shown, in periods of the carrier. */
const MIN_CYCLES = 2;
/**
 * The longest. More carrier cycles than this and they are too thin to
 * read, on a phone especially.
 */
const MAX_CYCLES = 40;
/**
 * Samples per device pixel. At the top of the ratio and index ranges the
 * output wiggles some 160 times across the plot; fewer samples would draw
 * a different, aliased curve.
 */
const SAMPLES_PER_PIXEL = 4;

/**
 * How much of the signal the figure shows, in periods of the carrier.
 *
 * Phase modulation gets two carrier cycles. True FM is there to show a
 * slow modulator as a wobble in pitch, which two carrier cycles would
 * hide, so it gets two cycles of the modulator instead, within limits: at
 * the slowest rates forty carrier cycles is only part of one wobble.
 */
export function cyclesShown(state: LabState): number {
  if (state.mode === 'pm') return MIN_CYCLES;
  const twoWobbles = 2 / patchOf(state).ratio;
  return Math.min(MAX_CYCLES, Math.max(MIN_CYCLES, twoWobbles));
}

/** The carrier can be drawn this many times slower than it sounds. */
const SLOW_FACTORS = [1, 2, 5, 10, 20, 50, 100];
/** About how many of its cycles the moving view aims to show. */
const MOTION_CYCLES = 10;
/** And the most it will: beyond this the window is cut short instead. */
const MOTION_MAX_CYCLES = 24;
/**
 * The slowed carrier stays this many times above the deviation, so its
 * frequency never reaches zero and the drawn wave never runs backwards.
 */
const DEVIATION_HEADROOM = 1.25;

/** The moving view of a slow vibrato. */
export interface MotionView {
  /** How many times slower than it sounds the carrier is drawn. */
  slow: number;
  /** The carrier's frequency as drawn: its real one over `slow`. */
  shownHz: number;
  /** How much time the window holds, in real seconds. */
  seconds: number;
}

/**
 * The moving view for a patch, or null when it has none.
 *
 * It is for true FM with a modulator too slow for the still view to hold
 * two wobbles: the vibrato range, where the wobble is slow enough to
 * watch. There the trouble is that the carrier is far faster than the
 * wobble: a window long enough to show the pitch moving holds too many
 * carrier cycles to see, and a 20 Hz push on 220 Hz barely changes their
 * spacing anyway. So the carrier is drawn slowed down, by a round factor,
 * while the modulator and the deviation are left as they are. The same
 * push on a slower carrier is a far bigger squeeze, and the window can
 * span a whole wobble with each wave still plain.
 *
 * The factor aims for about ten carrier cycles in one wobble, and stops
 * short of slowing the carrier to within reach of the deviation. When that
 * leaves too many cycles for one wobble, the window shows less than one.
 */
export function motionView(state: LabState): MotionView | null {
  if (state.mode !== 'fm') return null;
  const { carrierHz, modHz, deviationHz } = state;
  if ((2 * carrierHz) / modHz <= MAX_CYCLES) return null;

  const wanted = carrierHz / (MOTION_CYCLES * modHz);
  const limit =
    deviationHz > 0 ? carrierHz / (DEVIATION_HEADROOM * deviationHz) : Infinity;
  const allowed = SLOW_FACTORS.filter(factor => factor <= limit);
  const slow =
    allowed.find(factor => factor >= wanted) ?? allowed[allowed.length - 1] ?? 1;

  const shownHz = carrierHz / slow;
  const seconds = Math.min(1 / modHz, MOTION_MAX_CYCLES / shownHz);
  return { slow, shownHz, seconds };
}

function trace(plot: Plot, samples: Float32Array): void {
  const { ctx, left, right } = plot;
  const step = (right - left) / (samples.length - 1);
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const x = left + i * step;
    const y = ampToY(plot, samples[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** What one drawing of the figure shows: an x axis and two curves on it. */
interface Scene {
  /** The length of the x axis, in the units of `ticks` and the curves. */
  span: number;
  ticks: Tick[];
  title: string;
  output: (at: number) => number;
  modulator: (at: number) => number;
}

/** The still view: the signal from its start, in carrier cycles. */
function stillScene(state: LabState): Scene {
  const { ratio, index } = patchOf(state);
  const span = cyclesShown(state);
  const signal = state.mode === 'fm' ? trueFmSample : fmSample;
  return {
    span,
    ticks: waveformTicks(span, state.carrierHz),
    title: 'time: cycles of the carrier, and ms',
    output: cycles => signal(cycles, ratio, index),
    modulator: cycles => modulatorSample(cycles, ratio),
  };
}

/**
 * How much time the figure shows on a fixed axis in real units: 20 ms,
 * which is one cycle and a bit of the lowest carrier and about eighteen
 * of the highest.
 */
export const REAL_SECONDS = 0.02;

/**
 * The view on a fixed axis in real time: the signal's first 20 ms. Raise
 * the carrier and more waves fit, which carrier-cycle axes cannot show.
 */
function realScene(state: LabState): Scene {
  const { ratio, index } = patchOf(state);
  const { carrierHz } = state;
  const signal = state.mode === 'fm' ? trueFmSample : fmSample;
  return {
    span: REAL_SECONDS,
    ticks: msTicks(REAL_SECONDS),
    title: 'time, in ms',
    output: seconds => signal(seconds * carrierHz, ratio, index),
    modulator: seconds => modulatorSample(seconds * carrierHz, ratio),
  };
}

/** The moving view: the next stretch of signal from `time`, in seconds. */
function movingScene(state: LabState, view: MotionView, time: number): Scene {
  const { modHz, deviationHz } = state;
  return {
    span: view.seconds,
    ticks: msTicks(view.seconds),
    title: 'time, in ms',
    output: offset =>
      fmWindowSample(time, offset, view.shownHz, modHz, deviationHz),
    modulator: offset => Math.sin(TWO_PI * modHz * (time + offset)),
  };
}

/**
 * Draws the patch's output in --pen-blue and, if the state asks for it,
 * the modulator behind it, thinner and fainter, in --pen-green. It is
 * drawn from the parameters, not from the audio, so it is there before
 * any sound is.
 *
 * Without a `time` it is the still view, the signal from its start: so
 * many carrier cycles, or with `realUnits` a fixed 20 ms. With
 * one, in seconds, and a patch that has a moving view (see `motionView`),
 * it is that view at that moment: call it every frame and a slow vibrato
 * is seen to squeeze and stretch.
 */
export function drawWaveform(
  state: LabState,
  canvas: HTMLCanvasElement,
  time?: number,
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token, left, right, dpr } = plot;

  const view = time === undefined ? null : motionView(state);
  const scene =
    view && time !== undefined
      ? movingScene(state, view, time)
      : state.realUnits
        ? realScene(state)
        : stillScene(state);
  const { span } = scene;

  drawFrame(
    plot,
    scene.ticks,
    at => left + (at / span) * (right - left),
    scene.title,
  );

  const count = Math.ceil((right - left) * dpr * SAMPLES_PER_PIXEL);
  ctx.lineJoin = 'round';

  if (state.showModulator) {
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = token('--pen-green');
    trace(plot, sampleCycles(scene.modulator, span, count));
    ctx.globalAlpha = 1;
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = token('--pen-blue');
  trace(plot, sampleCycles(scene.output, span, count));
}
