import { fftMagnitudes } from '../../dsp/fft';
import { decayFor, MAX_DECAY, mixGains, PlateReverb } from '../../dsp/plateReverb';

// The sandbox's plate (Dattorro 1997): its decay, mix, tone and stability.

const RATE = 48000;

/** `seconds` of the reverb's output for `input` (padded with silence). */
function run(verb: PlateReverb, input: Float32Array, seconds: number): { left: Float32Array; right: Float32Array } {
  const length = Math.round(seconds * RATE);
  const padded = new Float32Array(length);
  padded.set(input.subarray(0, length));
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let at = 0; at < length; at += 128) {
    const n = Math.min(128, length - at);
    verb.process(padded.subarray(at, at + n), left.subarray(at, at + n), right.subarray(at, at + n), n);
  }
  return { left, right };
}

const impulse = () => Float32Array.of(1);

/** The -60 dB time of a tail, by Schroeder's backward integration: twice the time from -5 to -35 dB. */
function rt60(left: Float32Array, right: Float32Array): number {
  const n = left.length;
  const energy = new Float64Array(n + 1);
  for (let i = n - 1; i >= 0; i--) energy[i] = energy[i + 1] + left[i] ** 2 + right[i] ** 2;
  const db = (i: number) => 10 * Math.log10(energy[i] / energy[0]);
  let from = 0;
  while (db(from) > -5) from++;
  let to = from;
  while (to < n - 1 && db(to) > -35) to++;
  return ((to - from) / RATE) * 2;
}

const wetOnly = (seconds: number, tone = 70) => {
  const verb = new PlateReverb(RATE);
  verb.set({ seconds, tone, mix: 100, preDelay: 0 }, true);
  return verb;
};

describe('the plate reverb', () => {
  it('rings for the time asked, within 15%, from 0.5 s to 20 s', () => {
    for (const seconds of [0.5, 1.5, 5, 20]) {
      const { left, right } = run(wetOnly(seconds), impulse(), seconds * 1.6 + 0.5);
      expect(Math.abs(rt60(left, right) / seconds - 1)).toBeLessThan(0.15);
    }
  }, 120_000);

  it('decays: each 100 ms of the tail has less energy than the one before', () => {
    const { left, right } = run(wetOnly(1.5), impulse(), 2);
    const window = RATE / 10;
    const energies: number[] = [];
    // From 200 ms on, once the pre-delay and the diffusers have filled the tank.
    for (let at = 2 * window; at + window <= left.length; at += window) {
      let sum = 0;
      for (let i = at; i < at + window; i++) sum += left[i] ** 2 + right[i] ** 2;
      energies.push(sum);
    }
    energies.slice(1).forEach((energy, i) => expect(energy).toBeLessThan(energies[i]));
  });

  it('is stereo: its two sides\' tails are far from alike', () => {
    const { left, right } = run(wetOnly(1.5), impulse(), 1.5);
    let lr = 0;
    let ll = 0;
    let rr = 0;
    for (let i = 0; i < left.length; i++) {
      lr += left[i] * right[i];
      ll += left[i] ** 2;
      rr += right[i] ** 2;
    }
    // About 0.5: well apart, from one mono input.
    expect(Math.abs(lr / Math.sqrt(ll * rr))).toBeLessThan(0.6);
  });

  it('mixes: 0% is the dry alone, 100% no dry, 25% the dry at full', () => {
    const noise = Float32Array.from({ length: RATE / 2 }, () => Math.random() * 2 - 1);
    // 0%: exactly the dry, nothing added (once glided there).
    const dryOnly = new PlateReverb(RATE);
    dryOnly.set({ seconds: 1.5, tone: 70, mix: 0, preDelay: 0 }, true);
    const { left } = run(dryOnly, noise, 0.5);
    for (let i = RATE / 10; i < left.length; i++) expect(left[i]).toBeCloseTo(noise[i], 6);
    expect(mixGains(0)).toEqual({ dry: 1, wet: 0 });
    expect(mixGains(25)).toEqual({ dry: 1, wet: 0.5 });
    expect(mixGains(50)).toEqual({ dry: 1, wet: 1 });
    expect(mixGains(100)).toEqual({ dry: 0, wet: 1 });
    // 100%: once the dry has glided out, an impulse's own moment is
    // silent (the pre-delay holds the wet back 10 ms).
    const verb = wetOnly(1.5);
    run(verb, new Float32Array(1), 0.1);
    const { left: wet } = run(verb, impulse(), 0.005);
    expect(wet.every(x => x === 0)).toBe(true);
  });

  it('is darker at Tone 0 than at 100: less energy above 5 kHz', () => {
    const high = (tone: number) => {
      // Later in the tail, where the damping has acted on many passes.
      const { left } = run(wetOnly(2, tone), impulse(), 1.5);
      const spectrum = fftMagnitudes(left.subarray(RATE / 2, RATE / 2 + 32768));
      const from = Math.round((5000 / RATE) * 32768);
      let sum = 0;
      for (let k = from; k < spectrum.length; k++) sum += spectrum[k] ** 2;
      return sum;
    };
    expect(high(0)).toBeLessThan(high(100) / 2);
  });

  it('is silent for silence once cleared, and adds nothing at mix 0', () => {
    const verb = wetOnly(5);
    run(verb, impulse(), 0.5);
    verb.clear();
    const { left, right } = run(verb, new Float32Array(1), 0.5);
    expect(left.every(x => x === 0) && right.every(x => x === 0)).toBe(true);
  });

  it('stays bounded through 30 s of white noise at 20 s, at every tone', () => {
    for (const tone of [0, 70, 100]) {
      const verb = wetOnly(20, tone);
      const noise = Float32Array.from({ length: 30 * RATE }, () => Math.random() * 2 - 1);
      const { left, right } = run(verb, noise, 30);
      let most = 0;
      for (let i = 0; i < left.length; i++) most = Math.max(most, Math.abs(left[i]), Math.abs(right[i]));
      expect(Number.isFinite(most)).toBe(true);
      expect(most).toBeLessThan(20);
    }
  }, 120_000);

  it('turns off by gliding the wet down, then stops and costs nothing', () => {
    const verb = new PlateReverb(RATE);
    verb.set({ seconds: 3, tone: 70, mix: 50, preDelay: 0 }, true);
    run(verb, impulse(), 0.2);
    expect(verb.active).toBe(true);
    verb.set({ seconds: 3, tone: 70, mix: 50, preDelay: 0 }, false);
    run(verb, new Float32Array(1), 0.1);
    expect(verb.active).toBe(false);
    expect(verb.tailSeconds).toBe(0);
  });

  it('never lets the decay reach 1', () => {
    expect(decayFor(1e9, RATE, 35000)).toBe(MAX_DECAY);
    expect(decayFor(1.5, RATE, 35000)).toBeLessThan(MAX_DECAY);
  });

  it('starts the tail the pre-delay after the sound, within a sample', () => {
    const first = (preDelay: number) => {
      const verb = new PlateReverb(RATE);
      verb.set({ seconds: 1.5, tone: 70, mix: 100, preDelay }, true);
      // Past the 50 ms glides (the dry out, the pre-delay to its place).
      run(verb, new Float32Array(1), 0.1);
      const { left, right } = run(verb, impulse(), 0.8);
      return left.findIndex((x, i) => x !== 0 || right[i] !== 0);
    };
    // The plate's own way through to its taps, with no pre-delay.
    const own = first(0);
    expect(own).toBeGreaterThan(0);
    for (const ms of [40, 500]) expect(Math.abs(first(ms / 1000) - own - (ms / 1000) * RATE)).toBeLessThanOrEqual(1);
  });

  it('crossfades a turn of the pre-delay: no jump in the wet beyond the noise\'s own', () => {
    const verb = new PlateReverb(RATE);
    verb.set({ seconds: 1.5, tone: 70, mix: 100, preDelay: 0 }, true);
    const noise = Float32Array.from({ length: RATE }, () => Math.random() * 2 - 1);
    const steadyRun = run(verb, noise, 1);
    const steepest = (xs: Float32Array) => {
      let most = 0;
      for (let i = 1; i < xs.length; i++) most = Math.max(most, Math.abs(xs[i] - xs[i - 1]));
      return most;
    };
    const steady = steepest(steadyRun.left.subarray(RATE / 2));
    verb.set({ seconds: 1.5, tone: 70, mix: 100, preDelay: 0.5 }, true);
    const turned = run(verb, noise.subarray(0, RATE / 5), 0.2);
    expect(steepest(turned.left)).toBeLessThan(steady * 1.5);
    expect(verb.tailSeconds).toBeCloseTo(2, 9);
  });
});

