import {
  fmSample,
  modulatorSample,
  sampleCycles,
  trueFmSample,
} from '../dsp/waveform';
import { type LabState, patchOf } from '../model/lab';
import { ampToY, beginPlot, drawFrame, type Plot } from './plot';
import { waveformTicks } from './ticks';

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

/**
 * Draws the patch's output from its start in --pen-blue and, if the state
 * asks for it, the modulator behind it, thinner and fainter, in
 * --pen-green. It is drawn from the parameters, not from the audio, so it
 * stands still and is there before any sound is.
 */
export function drawWaveform(state: LabState, canvas: HTMLCanvasElement): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token, left, right, dpr } = plot;
  const { ratio, index } = patchOf(state);
  const cycles = cyclesShown(state);
  const signal = state.mode === 'fm' ? trueFmSample : fmSample;

  drawFrame(
    plot,
    waveformTicks(cycles, state.carrierHz),
    cycle => left + (cycle / cycles) * (right - left),
    'time: cycles of the carrier, and ms',
  );

  const count = Math.ceil((right - left) * dpr * SAMPLES_PER_PIXEL);
  ctx.lineJoin = 'round';

  if (state.showModulator) {
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = token('--pen-green');
    trace(plot, sampleCycles(t => modulatorSample(t, ratio), cycles, count));
    ctx.globalAlpha = 1;
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = token('--pen-blue');
  trace(plot, sampleCycles(t => signal(t, ratio, index), cycles, count));
}
