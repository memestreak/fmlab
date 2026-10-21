import { HELD_LFO, LFO_SPEED, LFO_TREMOLO, LFO_VIBRATO, lfoDepths, lfoOn } from '../../dsp/dx7';
import {
  AMS_SHARES,
  delayGain,
  dx7LfoDelay,
  dx7LfoHz,
  dx7TremoloDb,
  dx7VibratoCents,
  heldValue,
  Lfo,
  nextRandom,
  SYNC_PHASE,
  waveAt,
} from '../../dsp/lfo';

const SAMPLE_RATE = 48000;

/** msfa's getsample for a Q32 phase, over 2^24: its formulas, as written in lfo.cc. */
function msfa(wave: number, phase: number): number {
  const p = phase >>> 0;
  switch (wave) {
    case 0: {
      let x = p >>> 7;
      x ^= -(p >>> 31);
      return (x & ((1 << 24) - 1)) / 2 ** 24;
    }
    case 1:
      return ((~p ^ (1 << 31)) >>> 8) / 2 ** 24;
    case 2:
      return ((p ^ (1 << 31)) >>> 8) / 2 ** 24;
    case 3:
      return ((~p >>> 7) & (1 << 24)) / 2 ** 24;
    default:
      return 0.5 + 0.5 * Math.sin((2 * Math.PI * p) / 2 ** 32);
  }
}

describe('the LFO\'s waves', () => {
  const waves = ['triangle', 'sawDown', 'sawUp', 'square', 'sine'] as const;

  it('follow msfa\'s formulas at known phases', () => {
    for (const [i, wave] of waves.entries()) {
      for (const at of [0.01, 0.2, 0.3, 0.49, 0.51, 0.75, 0.99]) {
        expect(waveAt(wave, at)).toBeCloseTo(msfa(i, Math.round(at * 2 ** 32)), 4);
      }
    }
  });

  it('have the shapes their names say', () => {
    expect(waveAt('triangle', 0)).toBe(0);
    expect(waveAt('triangle', 0.5)).toBe(1);
    expect(waveAt('sawDown', 0.25)).toBeCloseTo(0.25, 9);
    expect(waveAt('sawUp', 0.25)).toBeCloseTo(0.75, 9);
    expect(waveAt('square', 0.25)).toBe(1);
    expect(waveAt('square', 0.75)).toBe(0);
    expect(waveAt('sine', 0.25)).toBeCloseTo(1, 9);
  });

  it('take a sample and hold from msfa\'s generator, once a cycle', () => {
    expect(nextRandom(0)).toBe(17);
    expect(nextRandom(17)).toBe((17 * 179 + 17) & 0xff);
    expect(heldValue(0x80)).toBe(1 / 256);
    const lfo = new Lfo();
    lfo.set({ ...HELD_LFO, wave: 'sampleHold', speed: 10, vibrato: 100 }, SAMPLE_RATE);
    const values = Array.from({ length: SAMPLE_RATE / 2 }, () => lfo.next().pitch);
    // Five cycles: five values, each held a cycle.
    const changes = values.filter((v, i) => i > 0 && v !== values[i - 1]).length;
    expect(changes).toBe(5);
  });
});

describe('the LFO\'s speed and delay', () => {
  it('turn the DX7\'s steps into Hz as msfa does', () => {
    const steps: [number, number][] = [[0, 0.065], [1, 0.13], [10, 1.6], [35, 5.8], [50, 8.3], [70, 12.7], [99, 23.9]];
    for (const [step, hz] of steps) expect(dx7LfoHz(step)).toBeCloseTo(hz, 1);
    expect(LFO_SPEED.max).toBeCloseTo(23.93, 2);
  });

  it('turn the DX7\'s delay steps into seconds', () => {
    expect(dx7LfoDelay(0)).toBe(0);
    const steps: [number, number][] = [[30, 0.13], [50, 0.313], [70, 0.735], [99, 2.664]];
    for (const [step, seconds] of steps) expect(dx7LfoDelay(step)).toBeCloseTo(seconds, 2);
  });

  it('hold the LFO back for the delay, then fade it in over at most 0.666 s', () => {
    expect(delayGain(0, 0)).toBe(1);
    expect(delayGain(0.3, 0.2)).toBe(0);
    expect(delayGain(0.3, 0.45)).toBeCloseTo(0.5, 9);
    expect(delayGain(0.3, 0.6)).toBe(1);
    expect(delayGain(2, 2 + 0.333)).toBeCloseTo(0.5, 2);
    expect(delayGain(2, 2.7)).toBe(1);
  });
});

describe('the LFO\'s depths', () => {
  it('merge PMD and PMS into cents, about 1190 at most', () => {
    expect(dx7VibratoCents(99, 7)).toBeCloseTo(1190.6, 1);
    expect(dx7VibratoCents(99, 1)).toBeCloseTo(46.7, 1);
    expect(dx7VibratoCents(0, 7)).toBe(0);
    expect(LFO_VIBRATO.max).toBe(dx7VibratoCents(99, 7));
  });

  it('turn AMD into dB as Dexed pulls a full-level operator, about 91.7 at most', () => {
    expect(dx7TremoloDb(0)).toBe(0);
    expect(dx7TremoloDb(99)).toBeCloseTo(91.7, 1);
    expect(LFO_TREMOLO.max).toBe(dx7TremoloDb(99));
  });

  it('give each AMS Dexed\'s share: none, 66, 109 and 255 of 255', () => {
    expect(AMS_SHARES[0]).toBe(0);
    expect(AMS_SHARES[1]).toBeCloseTo(66 / 255, 3);
    expect(AMS_SHARES[2]).toBeCloseTo(109 / 255, 3);
    expect(AMS_SHARES[3]).toBe(1);
  });
});

describe('the LFO and the keys', () => {
  it('starts the wave half a cycle in on each key, with key sync', () => {
    expect(SYNC_PHASE).toBeCloseTo(0.5, 9);
    expect(SYNC_PHASE).toBeLessThan(0.5);
    const lfo = new Lfo();
    lfo.set({ ...HELD_LFO, wave: 'triangle', speed: 1 }, SAMPLE_RATE);
    for (let i = 0; i < 1000; i++) lfo.next();
    lfo.keyDown();
    // The triangle's top: the pitch swings full up, levels are let be.
    const { pitch, amp } = lfo.next();
    expect(pitch).toBeCloseTo(1, 3);
    expect(amp).toBeCloseTo(0, 3);
  });

  it('leaves the wave where it is on a key without key sync', () => {
    const lfo = new Lfo();
    lfo.set({ ...HELD_LFO, wave: 'sawUp', speed: 1, sync: false }, SAMPLE_RATE);
    for (let i = 0; i < 1000; i++) lfo.next();
    const before = lfo.next().pitch;
    lfo.keyDown();
    expect(lfo.next().pitch).toBeCloseTo(before, 3);
  });

  it('restarts the delay on every key down', () => {
    const lfo = new Lfo();
    lfo.set({ ...HELD_LFO, wave: 'square', speed: 0.065, delay: 0.1 }, SAMPLE_RATE);
    lfo.keyDown();
    const run = (seconds: number) => {
      let last = 0;
      for (let i = 0; i < seconds * SAMPLE_RATE; i++) last = lfo.next().amp;
      return last;
    };
    expect(run(0.05)).toBe(0);
    expect(run(0.3)).toBeCloseTo(1, 6);
    lfo.keyDown();
    expect(run(0.05)).toBe(0);
  });
});

describe('the mod wheel', () => {
  const lfo = { ...HELD_LFO, vibrato: 10, tremolo: 2, wheelVibrato: 50, wheelTremolo: 6 };

  it('adds its share of the wheel depths to the LFO\'s own', () => {
    expect(lfoDepths(lfo, 0)).toEqual({ vibrato: 10, tremolo: 2 });
    expect(lfoDepths(lfo, 0.4)).toEqual({ vibrato: 30, tremolo: 2 + 0.4 * 6 });
    expect(lfoDepths(lfo, 1)).toEqual({ vibrato: 60, tremolo: 8 });
  });

  it('never takes the depths past the LFO\'s ranges', () => {
    const deep = { ...lfo, vibrato: 1000, tremolo: 80, wheelVibrato: LFO_VIBRATO.max, wheelTremolo: LFO_TREMOLO.max };
    expect(lfoDepths(deep, 1)).toEqual({ vibrato: LFO_VIBRATO.max, tremolo: LFO_TREMOLO.max });
    expect(LFO_VIBRATO.max).toBeCloseTo(1190, -1);
    expect(LFO_TREMOLO.max).toBeCloseTo(91.7, 1);
  });

  it('turns the LFO on while it adds a depth', () => {
    const still = { ...HELD_LFO, wheelVibrato: 50, wheelTremolo: 0 };
    expect(lfoOn(still)).toBe(false);
    expect(lfoOn(still, 0.01)).toBe(true);
    expect(lfoOn({ ...still, wheelVibrato: 0 }, 1)).toBe(false);
  });
});
