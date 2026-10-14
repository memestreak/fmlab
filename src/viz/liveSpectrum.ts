import type { LabState } from '../model/lab';
import { ampToY, beginPlot, type Plot } from './plot';
import { axisSpan, drawPredicted, drawSpectrumFrame } from './spectrumPlot';

/**
 * What the audio engine measures: the output's spectrum as Web Audio's
 * AnalyserNode gives it, in dB per frequency bin.
 */
export interface Measurement {
  /** dB per bin, from 0 Hz up to half the sample rate. */
  db: Float32Array;
  sampleRate: number;
  /** The FFT's length: twice the number of bins. */
  fftSize: number;
}

/**
 * The analyser's window (Blackman) keeps 0.42 of a steady sine wave's
 * height, and its transform splits a sine's energy between a positive
 * and a negative frequency, halving it again. A sine of amplitude A
 * therefore reads as A * 0.42 / 2 at its peak.
 */
const PEAK_SCALE = 0.42 / 2;

/** How the live view draws on: the predicted stems, faintly. */
const PREDICTED_OPACITY = 0.3;

/** The frequency in Hz at the centre of FFT bin `bin`. */
export function binHz(bin: number, fftSize: number, sampleRate: number): number {
  return (bin * sampleRate) / fftSize;
}

/**
 * An amplitude from a bin's dB, on the same scale as the predicted stems:
 * a sine at full height (1) reads as 1. -Infinity (nothing there) is 0.
 */
export function amplitudeFromDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return 10 ** (db / 20) / PEAK_SCALE;
}

/**
 * The measurement as points to draw: each bin's frequency in carrier units
 * and its amplitude, from 0 up to `maxFreq` carriers. Bins above the top of
 * the axis are left out.
 */
export function liveTrace(
  measured: Measurement,
  carrierHz: number,
  maxFreq: number,
): { freq: number; amp: number }[] {
  const { db, fftSize, sampleRate } = measured;
  const points: { freq: number; amp: number }[] = [];
  for (let bin = 0; bin < db.length; bin++) {
    const freq = binHz(bin, fftSize, sampleRate) / carrierHz;
    if (freq > maxFreq) break;
    points.push({ freq, amp: amplitudeFromDb(db[bin]) });
  }
  return points;
}

/**
 * Draws the live view: the predicted stems faintly, and over them the
 * measured spectrum of what is being played, a --pen-blue curve filled
 * down to the axis, on the same axes. Its heights are magnitudes, so it
 * never goes below the axis: a measured spectrum does not show phase.
 *
 * With no measurement (no sound playing) the curve lies flat on the axis.
 */
export function drawLiveSpectrum(
  state: LabState,
  canvas: HTMLCanvasElement,
  measured: Measurement | null,
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const x = drawSpectrumFrame(plot, state);
  drawPredicted(plot, state, x, undefined, PREDICTED_OPACITY);
  const maxFreq = axisSpan(state);
  const points = measured
    ? liveTrace(measured, state.carrierHz, maxFreq)
    : [
        { freq: 0, amp: 0 },
        { freq: maxFreq, amp: 0 },
      ];
  trace(plot, points, x);
}

function trace(
  plot: Plot,
  points: { freq: number; amp: number }[],
  x: (freq: number) => number,
): void {
  const { ctx, token } = plot;
  const axis = ampToY(plot, 0);
  // Never above the top of the plot: the limiter keeps the sound in
  // bounds, but a measurement can overshoot by a whisker.
  const y = (amp: number) => ampToY(plot, Math.min(1, amp));

  ctx.beginPath();
  ctx.moveTo(x(points[0].freq), axis);
  for (const point of points) ctx.lineTo(x(point.freq), y(point.amp));
  ctx.lineTo(x(points[points.length - 1].freq), axis);
  ctx.closePath();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = token('--pen-blue');
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.beginPath();
  points.forEach((point, i) => {
    if (i === 0) ctx.moveTo(x(point.freq), y(point.amp));
    else ctx.lineTo(x(point.freq), y(point.amp));
  });
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = token('--pen-blue');
  ctx.stroke();
}
