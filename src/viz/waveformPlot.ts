import { fmSample, modulatorSample, sampleCycles } from '../dsp/waveform';
import type { LabState } from '../model/lab';
import { ampToY, beginPlot, drawFrame, type Plot } from './plot';
import { waveformTicks } from './ticks';

/** How much of the signal is shown, in periods of the carrier. */
export const CYCLES_SHOWN = 2;
/**
 * Samples per device pixel. At the top of the ratio and index ranges the
 * output wiggles some 160 times across the plot; fewer samples would draw
 * a different, aliased curve.
 */
const SAMPLES_PER_PIXEL = 4;

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
 * Draws two carrier cycles of the patch's output in --pen-blue, with the
 * modulator behind it, thinner and fainter, in --pen-green. It is drawn
 * from the parameters, not from the audio, so it stands still and is
 * there before any sound is.
 */
export function drawWaveform(state: LabState, canvas: HTMLCanvasElement): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token, left, right, dpr } = plot;
  const { ratio, index } = state;

  drawFrame(
    plot,
    waveformTicks(CYCLES_SHOWN, state.carrierHz),
    cycle => left + (cycle / CYCLES_SHOWN) * (right - left),
    'time: cycles of the carrier, and ms',
  );

  const count = Math.ceil((right - left) * dpr * SAMPLES_PER_PIXEL);
  ctx.lineJoin = 'round';

  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = token('--pen-green');
  trace(plot, sampleCycles(t => modulatorSample(t, ratio), CYCLES_SHOWN, count));

  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = token('--pen-blue');
  trace(plot, sampleCycles(t => fmSample(t, ratio, index), CYCLES_SHOWN, count));
}
