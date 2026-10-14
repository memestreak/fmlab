import { besselJ } from '../../dsp/bessel';
import { envelopeAt } from '../../dsp/envelope';
import { fftMagnitudes } from '../../dsp/fft';
import { fmSpectrum } from '../../dsp/fmSpectrum';
import {
  kernelLevels,
  MOD_INDEX,
  noteHold,
  type Operator,
  operatorEnvelope,
  operatorSpectrum,
} from '../../dsp/operators';
import { algorithm } from '../../dsp/algorithms';
import { PmKernel } from '../../dsp/pmKernel';

const ampAt = (lines: { freq: number; amp: number }[], freq: number) =>
  lines.find(line => Math.abs(line.freq - freq) < 1e-3)?.amp ?? 0;

describe('fftMagnitudes', () => {
  it('finds a sine in its bin, half its height times the length', () => {
    const n = 64;
    const x = Array.from({ length: n }, (_, j) => 0.8 * Math.sin((2 * Math.PI * 5 * j) / n));
    const m = fftMagnitudes(x);
    expect(m).toHaveLength(n / 2 + 1);
    expect(m[5]).toBeCloseTo((0.8 * n) / 2, 9);
    expect(m[4]).toBeCloseTo(0, 9);
    expect(m[6]).toBeCloseTo(0, 9);
  });

  it('puts a constant in bin 0', () => {
    expect(fftMagnitudes([1, 1, 1, 1])[0]).toBeCloseTo(4, 12);
  });

  it('agrees with the plain sum it stands for', () => {
    const x = [0.3, -1, 2, 0.5, 0, 1.5, -0.7, 0.1];
    const m = fftMagnitudes(x);
    for (let k = 0; k <= 4; k++) {
      let re = 0;
      let im = 0;
      x.forEach((v, j) => {
        re += v * Math.cos((-2 * Math.PI * j * k) / 8);
        im += v * Math.sin((-2 * Math.PI * j * k) / 8);
      });
      expect(m[k]).toBeCloseTo(Math.hypot(re, im), 9);
    }
  });

  it('refuses a length that is not a power of two', () => {
    expect(() => fftMagnitudes([1, 2, 3])).toThrow(RangeError);
  });
});

describe('kernelLevels', () => {
  it('makes a modulator\'s level its index, and shares the carriers out', () => {
    // Algorithm 5: three pairs, carriers 1, 3 and 5.
    const levels = kernelLevels(algorithm(5), [0.9, 0.4, 0.6, 0.2, 0.3, 0.1]);
    expect(levels[0]).toBeCloseTo(0.3, 12);
    expect(levels[1]).toBeCloseTo(0.4 * MOD_INDEX, 12);
    expect(levels[2]).toBeCloseTo(0.2, 12);
    expect(levels[5]).toBeCloseTo(0.1 * MOD_INDEX, 12);
  });

  it('gives six carriers at full level a sound no louder than one', () => {
    const levels = kernelLevels(algorithm(32), [1, 1, 1, 1, 1, 1]);
    expect(levels.reduce((sum, level) => sum + level, 0)).toBeCloseTo(1, 12);
  });
});

describe('operators over a note', () => {
  const op = (decay: number): Operator => ({ ratio: 1, level: 1, decay });

  it('is held long enough for the slowest operator', () => {
    expect(noteHold([op(0), op(2.5), op(0.4)])).toBe(2.5);
  });

  it('is held at least a second, and at most six', () => {
    expect(noteHold([op(0), op(0.2)])).toBe(1);
    expect(noteHold([op(20)])).toBe(6);
  });

  it('dies away over an operator\'s decay, or holds when it has none', () => {
    const dying = operatorEnvelope(op(2), 2);
    expect(envelopeAt(dying, 0.005)).toBeCloseTo(1, 9);
    expect(envelopeAt(dying, 2)).toBeLessThan(0.03);
    const held = operatorEnvelope(op(0), 2);
    expect(envelopeAt(held, 1.5)).toBeCloseTo(1, 9);
    // Both let go together.
    expect(envelopeAt(held, 2.4)).toBeLessThan(0.05);
  });
});

describe('the kernel\'s feedback', () => {
  it('turns a sine into a brighter wave, and none leaves it a sine', () => {
    const alg = algorithm(32);
    const run = (feedback: number) => {
      const kernel = new PmKernel(alg, 1);
      const levels = kernelLevels(alg, [0, 0, 0, 0, 0, 1]);
      const ratios = [1, 1, 1, 1, 1, 1];
      const out = [];
      for (let i = 0; i < 4096 + 512; i++) out.push(kernel.tick(1 / 64, ratios, levels, feedback));
      return fftMagnitudes(out.slice(512));
    };
    const plain = run(0);
    const fed = run(1.5);
    // 4096 samples are 64 cycles: the fundamental is bin 64, harmonics at
    // multiples of it.
    expect(plain[128] / plain[64]).toBeLessThan(1e-3);
    expect(fed[128] / fed[64]).toBeGreaterThan(0.1);
  });
});

describe('operatorSpectrum', () => {
  const ratios = [1, 1, 1, 1, 1, 1];

  it('is the two-operator spectrum when four operators are silent', () => {
    // Algorithm 1: OP2 on OP1, and OP1 one of two carriers, so half
    // height. OP2 at level 0.4 is an index of 2.
    const lines = operatorSpectrum(1, ratios, [1, 0.4, 0, 0, 0, 0], 0);
    for (const { freq, amp } of fmSpectrum(1, 2)) {
      if (Math.abs(amp) < 0.01) continue;
      expect(ampAt(lines, freq)).toBeCloseTo(Math.abs(amp) / 2, 3);
    }
  });

  it('is six sines at the operators\' ratios with no modulation', () => {
    const lines = operatorSpectrum(32, [1, 2, 3, 4, 5, 6], [1, 1, 1, 1, 1, 1], 0);
    expect(lines.map(line => Math.round(line.freq * 100) / 100)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const line of lines) expect(line.amp).toBeCloseTo(1 / 6, 3);
  });

  it('finds partials that are not harmonics in their right places', () => {
    const lines = operatorSpectrum(1, [1, 1.4, 1, 1, 1, 1], [1, 0.2, 0, 0, 0, 0], 0);
    // Sidebands at 1 +- 1.4: 2.4, and 0.4 folded.
    expect(ampAt(lines, 2.4)).toBeCloseTo(besselJ(1, 1) / 2, 2);
    expect(ampAt(lines, 0.4)).toBeCloseTo(besselJ(1, 1) / 2, 2);
  });

  it('grows with a stack: more operators on top, more partials', () => {
    const one = operatorSpectrum(1, ratios, [0, 0, 1, 0.3, 0, 0], 0);
    const three = operatorSpectrum(1, ratios, [0, 0, 1, 0.3, 0.3, 0.3], 0);
    expect(three.length).toBeGreaterThan(one.length);
  });
});
