// What the Reverb tab's screen draws (viz/reverbPlot.ts): the plate's
// response to a click, as the energy of its lows and of its highs over
// time. Pure: the worker (reverbResponse.worker.ts) runs it off the main
// thread, and the tests run it in node.

import { PlateReverb } from './plateReverb';

/** The lows: under about this many Hz (two one-pole low-passes). */
export const LOWS_HZ = 500;
/** The highs: over about this many Hz (the signal less a one-pole low-pass). */
export const HIGHS_HZ = 4000;
/** The shortest window an envelope point averages, in seconds. */
export const WINDOW_SECONDS = 0.05;
/** Each curve is set against its loudest window in this long from its start, in seconds. */
export const START_SECONDS = 0.12;

/** The two bands' energy, in dB, a point a column. */
export interface BandEnvelopes {
  lows: Float32Array;
  highs: Float32Array;
}

/** A one-pole low-pass's coefficient for `hz` at `rate`. */
const pole = (hz: number, rate: number) => Math.exp((-2 * Math.PI * hz) / rate);

/**
 * The energy of `left` and `right`'s lows and highs, (L² + R²) / 2, in dB,
 * at `columns` points over the first `span` seconds: each point the mean
 * over a window of WINDOW_SECONDS or a column, whichever is longer, from
 * the column's start. A point past the signal's end is -Infinity. Not
 * set against its start: `fromStart` does that.
 */
export function bandEnvelopes(
  left: Float32Array,
  right: Float32Array,
  rate: number,
  columns: number,
  span: number,
): BandEnvelopes {
  const n = left.length;
  const lowEnergy = new Float64Array(n);
  const highEnergy = new Float64Array(n);
  const low = pole(LOWS_HZ, rate);
  const high = pole(HIGHS_HZ, rate);
  // Per channel: two low-passes for the lows; the signal less a low-pass for the highs.
  for (const channel of [left, right]) {
    let a = 0;
    let b = 0;
    let c = 0;
    for (let i = 0; i < n; i++) {
      const x = channel[i];
      a = (1 - low) * x + low * a;
      b = (1 - low) * a + low * b;
      c = (1 - high) * x + high * c;
      lowEnergy[i] += (b * b) / 2;
      highEnergy[i] += ((x - c) * (x - c)) / 2;
    }
  }
  // Running sums, so each window is a difference.
  const sum = (energy: Float64Array) => {
    const out = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) out[i + 1] = out[i] + energy[i];
    return out;
  };
  const lowSum = sum(lowEnergy);
  const highSum = sum(highEnergy);
  const width = Math.max(1, Math.round(Math.max(WINDOW_SECONDS, span / columns) * rate));
  const envelope = (sums: Float64Array) =>
    Float32Array.from({ length: columns }, (_, column) => {
      const from = Math.round(((column * span) / columns) * rate);
      if (from >= n) return -Infinity;
      const to = Math.min(n, from + width);
      const mean = (sums[to] - sums[from]) / (to - from);
      return mean > 0 ? 10 * Math.log10(mean) : -Infinity;
    });
  return { lows: envelope(lowSum), highs: envelope(highSum) };
}

/**
 * A curve set against its own start: the loudest point in its first
 * START_SECONDS taken as 0 dB, so two curves' slopes compare.
 */
export function fromStart(curve: Float32Array, span: number): Float32Array {
  const start = Math.max(1, Math.ceil((START_SECONDS / span) * curve.length));
  let loudest = -Infinity;
  for (let i = 0; i < Math.min(start, curve.length); i++) loudest = Math.max(loudest, curve[i]);
  return Float32Array.from(curve, db => db - loudest);
}

/** What the worker is asked: the plate's Decay and Tone, the points and the time they cover. */
export interface ResponseRequest {
  id: number;
  seconds: number;
  tone: number;
  columns: number;
  span: number;
}

/**
 * The plate's lows and highs after a click, worked out on the real
 * PlateReverb (wet only, no pre-delay: the screen moves the curves by the
 * Pre-delay itself) at `rate`, past its 50 ms glides first, for 1.3 times
 * the decay and 0.1 s. Only the two envelopes are kept.
 */
export function reverbResponse({ seconds, tone, columns, span }: Omit<ResponseRequest, 'id'>, rate = 48000): BandEnvelopes {
  const plate = new PlateReverb(rate);
  plate.set({ seconds, tone, mix: 100, preDelay: 0 }, true);
  const block = 128;
  const silence = new Float32Array(block);
  const scratchL = new Float32Array(block);
  const scratchR = new Float32Array(block);
  for (let i = 0; i < Math.ceil((0.06 * rate) / block); i++) plate.process(silence, scratchL, scratchR, block);
  const length = Math.round((1.3 * seconds + 0.1) * rate);
  const input = new Float32Array(length);
  input[0] = 1;
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let at = 0; at < length; at += block) {
    const frames = Math.min(block, length - at);
    plate.process(input.subarray(at, at + frames), left.subarray(at, at + frames), right.subarray(at, at + frames), frames);
  }
  return bandEnvelopes(left, right, rate, columns, span);
}
