import { besselJ, besselJSeries } from '../../dsp/bessel';
import { FmKernel } from '../../dsp/fmKernel';
import { fmSpectrum, trueFmSpectrum } from '../../dsp/fmSpectrum';
import { trueFmSample } from '../../dsp/waveform';

const SAMPLE_RATE = 48000;

describe('besselJSeries', () => {
  it('agrees with the power series where that is accurate', () => {
    for (const x of [0.3, 2, 2.405, 8, -5]) {
      const series = besselJSeries(12, x);
      for (let n = 0; n <= 12; n++) {
        expect(series[n]).toBeCloseTo(besselJ(n, x), 10);
      }
    }
  });

  it('is 1, 0, 0, ... at the origin', () => {
    expect([...besselJSeries(3, 0)]).toEqual([1, 0, 0, 0]);
  });

  it('matches tabulated values far beyond the power series', () => {
    expect(besselJSeries(1, 50)[0]).toBeCloseTo(0.0558123, 6);
    expect(besselJSeries(1, 100)[1]).toBeCloseTo(-0.0771454, 6);
  });

  // J0^2 + 2 (J1^2 + J2^2 + ...) = 1, at the index of the slowest,
  // deepest vibrato the page allows: 200 Hz of deviation at 0.5 Hz.
  it.each([40, 400])('conserves power at x = %s', x => {
    const series = besselJSeries(x + 100, x);
    let power = series[0] ** 2;
    for (let n = 1; n < series.length; n++) power += 2 * series[n] ** 2;
    expect(power).toBeCloseTo(1, 9);
  });
});

describe('trueFmSample', () => {
  it('is a plain sine with no deviation', () => {
    for (const t of [0, 0.2, 0.7, 3.4]) {
      expect(trueFmSample(t, 0.02, 0)).toBeCloseTo(Math.sin(2 * Math.PI * t), 12);
    }
  });

  it('starts as the plain carrier does, then runs ahead as the pitch rises', () => {
    expect(trueFmSample(0, 0.1, 4)).toBe(0);
    // A quarter of the way through the modulator's cycle the frequency
    // has been above the carrier's all along, so the phase is ahead by I.
    const quarter = 0.25 / 0.1;
    const phase = 2 * Math.PI * quarter + 4;
    expect(trueFmSample(quarter, 0.1, 4)).toBeCloseTo(Math.sin(phase), 12);
  });

  it('is back in step with the carrier after each modulator cycle', () => {
    for (const t of [0.3, 1.1]) {
      const later = t + 1 / 0.1;
      expect(trueFmSample(later, 0.1, 4)).toBeCloseTo(
        Math.sin(2 * Math.PI * later + 4 * (1 - Math.cos(2 * Math.PI * 0.1 * t))),
        9,
      );
    }
  });
});

describe('FmKernel', () => {
  const render = (count: number, hz: number, modHz: number, deviation: number) => {
    const kernel = new FmKernel();
    const out = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      out[i] = kernel.tick(hz / SAMPLE_RATE, modHz / SAMPLE_RATE, deviation / SAMPLE_RATE);
    }
    return out;
  };

  it('is a sine at the carrier frequency with no deviation', () => {
    const out = render(500, 480, 5, 0);
    for (const n of [0, 1, 77, 499]) {
      expect(out[n]).toBeCloseTo(Math.sin((2 * Math.PI * 480 * n) / SAMPLE_RATE), 9);
    }
  });

  it('plays the signal the waveform figure draws', () => {
    // A vibrato: 220 Hz pushed 20 Hz each way, 5 times a second, for one
    // whole wobble. The kernel adds the frequency up a sample at a time,
    // so it can differ from the exact sum by a few thousandths.
    const [hz, modHz, deviation] = [220, 5, 20];
    const out = render(SAMPLE_RATE / 5, hz, modHz, deviation);
    for (let n = 0; n < out.length; n += 7) {
      const cycles = (n * hz) / SAMPLE_RATE;
      expect(out[n]).toBeCloseTo(
        trueFmSample(cycles, modHz / hz, deviation / modHz),
        2,
      );
    }
  });

  it('swings the pitch by the deviation each way', () => {
    // Count zero crossings in the fast and the slow half of a 1 Hz wobble.
    const out = render(SAMPLE_RATE, 400, 1, 100);
    const crossings = (from: number, to: number) => {
      let count = 0;
      for (let n = from + 1; n < to; n++) {
        if (out[n - 1] < 0 !== out[n] < 0) count++;
      }
      return count;
    };
    const half = SAMPLE_RATE / 2;
    // Averaged over a half cycle the push is 2/pi of the peak: 64 Hz.
    expect(crossings(0, half)).toBeCloseTo(464, -1);
    expect(crossings(half, SAMPLE_RATE)).toBeCloseTo(336, -1);
  });

  it('starts both waves again after a reset', () => {
    const kernel = new FmKernel();
    for (let i = 0; i < 1000; i++) kernel.tick(0.01, 0.001, 0.002);
    kernel.reset();
    expect(kernel.tick(0.01, 0.001, 0.002)).toBe(0);
  });
});

describe('trueFmSpectrum', () => {
  it('is the bare carrier with no deviation', () => {
    const lines = trueFmSpectrum(0.02, 0);
    expect(lines).toHaveLength(1);
    expect(lines[0].freq).toBe(1);
    expect(lines[0].amp).toBeCloseTo(1, 12);
  });

  it('puts sideband n at 1 + n * ratio, as tall as |J_n(I)|', () => {
    // 5 Hz on 220 Hz with an index of 4: nothing reaches zero to fold.
    const ratio = 5 / 220;
    const lines = trueFmSpectrum(ratio, 4);
    const ampAt = (freq: number) =>
      lines.find(line => Math.abs(line.freq - freq) < 1e-6)?.amp ?? 0;
    for (const n of [0, 1, -1, 3, -4]) {
      expect(ampAt(1 + n * ratio)).toBeCloseTo(Math.abs(besselJ(n, 4)), 9);
    }
  });

  it('has only magnitudes: no line is negative', () => {
    expect(trueFmSpectrum(1, 2).every(line => line.amp > 0)).toBe(true);
    expect(trueFmSpectrum(0.3, 9).every(line => line.amp > 0)).toBe(true);
  });

  it('keeps all of the power when no lines coincide', () => {
    const power = trueFmSpectrum(5 / 220, 4).reduce((sum, l) => sum + l.amp ** 2, 0);
    expect(power).toBeCloseTo(1, 6);
  });

  it('holds a slow, deep vibrato: hundreds of lines round the carrier', () => {
    // 20 Hz of deviation at 0.5 Hz on 220 Hz: an index of 40.
    const lines = trueFmSpectrum(0.5 / 220, 40);
    expect(lines.length).toBeGreaterThan(80);
    // All within the deviation, give or take, of the carrier.
    expect(lines[0].freq).toBeGreaterThan(1 - 30 / 220);
    expect(lines[lines.length - 1].freq).toBeLessThan(1 + 30 / 220);
    expect(lines.reduce((sum, l) => sum + l.amp ** 2, 0)).toBeCloseTo(1, 6);
  });

  it('matches the played signal where lines do coincide', () => {
    // Ratio 1 folds sidebands on to one another, and with true FM they
    // meet at odd angles. Check against the signal itself: one carrier
    // cycle sampled finely, projected on to each harmonic.
    const index = 2;
    const count = 4096;
    const magnitudeAt = (harmonic: number) => {
      let re = 0;
      let im = 0;
      for (let n = 0; n < count; n++) {
        const t = n / count;
        const sample = trueFmSample(t, 1, index);
        re += sample * Math.cos(2 * Math.PI * harmonic * t);
        im += sample * Math.sin(2 * Math.PI * harmonic * t);
      }
      return (2 * Math.hypot(re, im)) / count;
    };
    const lines = trueFmSpectrum(1, index);
    expect(lines.length).toBeGreaterThan(4);
    for (const { freq, amp } of lines) {
      expect(magnitudeAt(freq)).toBeCloseTo(amp, 4);
    }
  });

  it('differs from phase modulation only in phase, away from folding', () => {
    const pm = fmSpectrum(0.05, 3);
    const fm = trueFmSpectrum(0.05, 3);
    expect(fm.map(line => line.freq)).toEqual(pm.map(line => line.freq));
    fm.forEach((line, i) => {
      expect(line.amp).toBeCloseTo(Math.abs(pm[i].amp), 9);
    });
  });
});
