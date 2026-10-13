import { fmSample, modulatorSample, sampleCycles } from '../../dsp/waveform';

describe('fmSample', () => {
  it('is a plain sine when the index is 0', () => {
    for (const t of [0, 0.1, 0.25, 0.6, 1.3]) {
      expect(fmSample(t, 3, 0)).toBeCloseTo(Math.sin(2 * Math.PI * t), 12);
    }
  });

  it('starts at zero, both sines rising', () => {
    expect(fmSample(0, 1, 2)).toBe(0);
    expect(fmSample(0.001, 1, 2)).toBeGreaterThan(0);
  });

  it('is sin(wc t + I sin(wm t))', () => {
    // A quarter of a carrier cycle at ratio 1: the modulator is at its
    // peak, so the phase is pi/2 + I.
    expect(fmSample(0.25, 1, 2)).toBeCloseTo(Math.sin(Math.PI / 2 + 2), 12);
    // Ratio 2 has the modulator back at zero there.
    expect(fmSample(0.25, 2, 5)).toBeCloseTo(1, 12);
  });

  it('repeats every carrier cycle at a whole-number ratio', () => {
    for (const t of [0.1, 0.37, 0.9]) {
      expect(fmSample(t + 1, 3, 4)).toBeCloseTo(fmSample(t, 3, 4), 9);
    }
  });

  it('never leaves -1 to 1', () => {
    for (let t = 0; t < 2; t += 0.001) {
      expect(Math.abs(fmSample(t, 1.4, 10))).toBeLessThanOrEqual(1);
    }
  });
});

describe('modulatorSample', () => {
  it('runs `ratio` cycles for each of the carrier', () => {
    expect(modulatorSample(0.125, 2)).toBeCloseTo(1, 12);
    expect(modulatorSample(0.5, 0.5)).toBeCloseTo(1, 12);
  });
});

describe('sampleCycles', () => {
  it('samples evenly from 0 to the last cycle, both included', () => {
    const times = sampleCycles(t => t, 2, 5);
    expect([...times]).toEqual([0, 0.5, 1, 1.5, 2]);
  });
});
