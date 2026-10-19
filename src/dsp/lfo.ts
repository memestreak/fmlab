// The DX7's LFO: one slow wave for the whole instrument, which moves every
// sounding note's pitch (vibrato) and its operators' levels (tremolo).
// After msfa's lfo.cc and dx7note.cc (github.com/asb2m10/dexed,
// source/msfa), run here a sample at a time rather than a block of 64:
// the six waves, a sample and hold from msfa's own generator, the delay
// that holds the LFO back after each key and then fades it in, and key
// sync, which starts the wave again half a cycle in. Pure: no Web Audio,
// so the pool runs it in the worklet and the tests run it in node.

import type { Dx7Lfo, LfoWave } from './dx7';

/** What the LFO does to a note at one sample. */
export interface LfoSample {
  /**
   * The pitch's swing, -1 to 1, delay and fade included: the vibrato in
   * cents times this is how far every operator's pitch moves.
   */
  pitch: number;
  /**
   * How far down levels are pulled, 0 to 1, delay and fade included: the
   * tremolo in dB, times an operator's share, times this, is how much its
   * level drops. As msfa's amplitude modulation it is the wave turned
   * over, so it pulls hardest where the wave is lowest.
   */
  amp: number;
}

/** One step of msfa's sample and hold generator: r → (r × 179 + 17) mod 256. */
export function nextRandom(r: number): number {
  return (r * 179 + 17) & 0xff;
}

/** The value, 0 to 1, a sample and hold holds for a generator state `r`. */
export function heldValue(r: number): number {
  return ((r ^ 0x80) + 1) / 256;
}

/**
 * A wave's value at `phase` (cycles, 0 to 1), from 0 to 1, as msfa's
 * `getsample` has it (its Q24 output over 2^24): the triangle 0 at the
 * start and 1 halfway; both saws a half at the start, the one down
 * falling and the one up rising, jumping halfway; the square 1 for the
 * first half and 0 for the second; the sine a half at the start, rising.
 * The sample and hold is `held`, its value this cycle.
 */
export function waveAt(wave: LfoWave, phase: number, held = 0.5): number {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case 'triangle':
      return p < 0.5 ? 2 * p : 2 - 2 * p;
    case 'sawDown':
      return p < 0.5 ? 0.5 - p : 1.5 - p;
    case 'sawUp':
      return p < 0.5 ? 0.5 + p : p - 0.5;
    case 'square':
      return p < 0.5 ? 1 : 0;
    case 'sine':
      return 0.5 + 0.5 * Math.sin(2 * Math.PI * p);
    case 'sampleHold':
      return held;
  }
}

/** Where key sync starts the wave: msfa's phase 2^31 - 1, just short of halfway. */
export const SYNC_PHASE = (2 ** 31 - 1) / 2 ** 32;

/** The longest the delay's fade in lasts, in seconds (msfa's at its slowest). */
export const MAX_FADE_SECONDS = 0.666;

/**
 * How far the LFO is let in, 0 to 1, `time` seconds after the last key
 * went down: nothing for `delay`, then a straight rise over
 * min(delay, 0.666 s), then all of it.
 */
export function delayGain(delay: number, time: number): number {
  if (time >= delay + fadeSeconds(delay)) return 1;
  if (time <= delay) return 0;
  return (time - delay) / fadeSeconds(delay);
}

/** How long the delay's fade in lasts. */
export function fadeSeconds(delay: number): number {
  return Math.min(delay, MAX_FADE_SECONDS);
}

/**
 * msfa's LFO speed for the DX7's 0 to 99, in Hz: sr = (165 × speed) >> 6
 * (1 at 0), times 11, or by 11 + ((sr - 160) >> 4) once sr reaches 160;
 * then sr × 25190424 / 2^32 cycles a second.
 */
export function dx7LfoHz(speed: number): number {
  let sr = speed === 0 ? 1 : (165 * speed) >> 6;
  sr *= sr < 160 ? 11 : 11 + ((sr - 160) >> 4);
  return (sr * 25190424) / 2 ** 32;
}

/**
 * msfa's LFO delay for the DX7's 0 to 99, in seconds: with a = 99 - delay,
 * the count steps by (16 + (a & 15)) << (1 + (a >> 4)) units of
 * 25190424 a second and the delay is over at 2^31; 0 is none.
 */
export function dx7LfoDelay(delay: number): number {
  if (delay === 0) return 0;
  const a = 99 - delay;
  const step = (16 + (a & 15)) << (1 + (a >> 4));
  return 2 ** 31 / (25190424 * step);
}

/** The pitch modulation sensitivities' weights, PMS 0 to 7 (msfa's pitchmodsenstab). */
export const PMS_WEIGHTS = [0, 10, 20, 33, 55, 92, 153, 255] as const;

/**
 * The vibrato in cents of a DX7 PMD (0 to 99) and PMS (0 to 7): msfa
 * swings the pitch by ((PMD × 165) >> 6) × weight × (wave - ½) / 32768 of
 * an octave, so the peak is that over 65536 octaves.
 */
export function dx7VibratoCents(pmd: number, pms: number): number {
  return (1200 * ((pmd * 165) >> 6) * PMS_WEIGHTS[pms]) / 65536;
}

/**
 * Each AMS's share of the voice's tremolo, 0 to 3 (Dexed's ampmodsenstab
 * over 2^24: 0, 66, 109 and 255 of 255).
 */
export const AMS_SHARES = [0, 4342338 / 2 ** 24, 7171437 / 2 ** 24, 1] as const;

/**
 * The tremolo in dB of a DX7 AMD (0 to 99): how far Dexed's amplitude
 * modulation pulls an operator at full level down at the bottom of the
 * wave with AMS 3. Dexed takes a share pt / 2^24 of the operator's level
 * in its log units (15 doublings at full, 6.02 dB each), with
 * pt = exp(0.0175 × ((AMD × 165) >> 6) + 12.2); the share at AMD 0 is
 * taken away, so 0 is none. AMD 99 is about 91.7 dB, all but silence.
 */
export function dx7TremoloDb(amd: number): number {
  const depth = (amd * 165) >> 6;
  const share = (pt: number) => (pt * 16) / 2 ** 28;
  const pulled = share(Math.exp(0.0175 * depth + 12.2)) - share(Math.exp(12.2));
  return 15 * 20 * Math.log10(2) * pulled;
}

/**
 * The LFO, a sample at a time. `set` takes the voice's settings, `keyDown`
 * is called for every key that goes down, and `next` gives each sample's
 * pitch swing and level pull.
 */
export class Lfo {
  private phase = 0;
  private perSample = 0;
  private wave: LfoWave = 'triangle';
  private delay = 0;
  private sync = true;
  /** Seconds since the last key went down. */
  private since = Infinity;
  private secondsPerSample = 1 / 48000;
  /** msfa's sample and hold generator, and the value held this cycle. */
  private random = 0;
  private held = heldValue(0);
  /** What `next` gives, the same object each time: nothing new per sample. */
  private readonly out: LfoSample = { pitch: 0, amp: 0 };

  set(lfo: Dx7Lfo, sampleRate: number): void {
    this.perSample = lfo.speed / sampleRate;
    this.secondsPerSample = 1 / sampleRate;
    this.wave = lfo.wave;
    this.delay = lfo.delay;
    this.sync = lfo.sync;
  }

  /**
   * A key went down: the delay starts again for the whole instrument, and
   * with key sync on so does the wave.
   */
  keyDown(): void {
    this.since = 0;
    if (this.sync) this.phase = SYNC_PHASE;
  }

  /** The next sample's swing and pull; the object is reused, so read it at once. */
  next(): LfoSample {
    // As msfa: the phase steps first, and a new random value is taken as
    // it comes round.
    this.phase += this.perSample;
    if (this.phase >= 1) {
      this.phase -= Math.floor(this.phase);
      this.random = nextRandom(this.random);
      this.held = heldValue(this.random);
    }
    const u = waveAt(this.wave, this.phase, this.held);
    const gain = delayGain(this.delay, this.since);
    this.since += this.secondsPerSample;
    this.out.pitch = (2 * u - 1) * gain;
    this.out.amp = (1 - u) * gain;
    return this.out;
  }
}
