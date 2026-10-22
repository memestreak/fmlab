import { fmSpectrum } from '../../dsp/fmSpectrum';
import { MAX_OPERATORS, PmKernel, sineCycles, TWO_OPERATORS } from '../../dsp/pmKernel';
import { fmSample } from '../../dsp/waveform';

const SAMPLE_RATE = 48000;
/** 50 ms, as the worklet sets it. */
const LOCK_SAMPLES = 0.05 * SAMPLE_RATE;

/** A two-operator kernel and a way to run it as the worklet does. */
function twoOperators() {
  const kernel = new PmKernel(TWO_OPERATORS, LOCK_SAMPLES);
  const ratios = new Float64Array(MAX_OPERATORS).fill(1);
  const levels = new Float64Array(MAX_OPERATORS).fill(1);
  return {
    render(count: number, hz: number, ratio: number, index: number) {
      ratios[1] = ratio;
      levels[1] = index;
      const out = new Float64Array(count);
      for (let i = 0; i < count; i++) {
        out[i] = kernel.tick(hz / SAMPLE_RATE, ratios, levels);
      }
      return out;
    },
  };
}

describe('PmKernel as two operators', () => {
  it('is a sine at the carrier frequency when the index is 0', () => {
    const out = twoOperators().render(1000, 480, 3, 0);
    for (const n of [0, 1, 25, 333, 999]) {
      // To 5e-7 (-126 dB): the kernel's sines come from a table (sineCycles).
      expect(out[n]).toBeCloseTo(Math.sin((2 * Math.PI * 480 * n) / SAMPLE_RATE), 6);
    }
  });

  it('plays the signal the waveform figure draws', () => {
    // 480 Hz is 100 samples a cycle.
    const out = twoOperators().render(1000, 480, 1.4, 3);
    for (let n = 0; n < out.length; n++) {
      // To 5e-6 (-106 dB): the table's error, carried through a modulator
      // at index 3, which multiplies it by up to the index.
      expect(out[n]).toBeCloseTo(fmSample(n / 100, 1.4, 3), 5);
    }
  });

  it('plays the spectrum the spectrum figure draws', () => {
    // One second at 100 Hz, ratio 1: every partial is a whole number of
    // cycles long, so projecting onto sin(2 pi k f t) reads its signed
    // amplitude off exactly.
    const hz = 100;
    const out = twoOperators().render(SAMPLE_RATE, hz, 1, 2);
    const amplitudeAt = (harmonic: number) => {
      let sum = 0;
      for (let n = 0; n < out.length; n++) {
        sum += out[n] * Math.sin((2 * Math.PI * harmonic * hz * n) / SAMPLE_RATE);
      }
      return (2 * sum) / out.length;
    };

    const lines = fmSpectrum(1, 2);
    expect(lines.length).toBeGreaterThan(4);
    // To within the sidebands fmSpectrum leaves out as inaudible
    // (MIN_AMPLITUDE, 1e-4), which the kernel still plays.
    for (const { freq, amp } of lines) {
      expect(amplitudeAt(freq)).toBeCloseTo(amp, 4);
    }
    // The carrier's own line, J0(2) - J2(2), comes out negative.
    expect(amplitudeAt(1)).toBeCloseTo(-0.129, 3);
  });

  it('keeps its phase through a change of carrier frequency', () => {
    const synth = twoOperators();
    const before = synth.render(500, 220, 1, 0);
    const after = synth.render(500, 440, 1, 0);
    // No jump at the join: the step is no bigger than 440 Hz can make.
    const step = Math.abs(after[0] - before[before.length - 1]);
    expect(step).toBeLessThanOrEqual((2 * Math.PI * 440) / SAMPLE_RATE);
  });

  it('pulls the modulator back into phase after the ratio moves', () => {
    const synth = twoOperators();
    synth.render(4800, 480, 1, 2);
    // A detour that leaves the modulator somewhere else in its cycle.
    synth.render(1234, 480, 1.37, 2);
    // Back at ratio 1, half a second is ten lock times.
    const settle = 24000;
    const out = synth.render(settle + 1000, 480, 1, 2);
    const start = 4800 + 1234 + settle;
    for (let n = 0; n < 1000; n++) {
      expect(out[settle + n]).toBeCloseTo(fmSample((start + n) / 100, 1, 2), 3);
    }
  });

  it('is out of phase straight after the ratio moves, so the pull matters', () => {
    const synth = twoOperators();
    synth.render(4800, 480, 1, 2);
    synth.render(1234, 480, 1.37, 2);
    const out = synth.render(100, 480, 1, 2);
    const start = 4800 + 1234;
    let worst = 0;
    for (let n = 0; n < out.length; n++) {
      worst = Math.max(worst, Math.abs(out[n] - fmSample((start + n) / 100, 1, 2)));
    }
    expect(worst).toBeGreaterThan(0.1);
  });
});

describe('the kernel\'s sine table', () => {
  it('is within 3e-7 of Math.sin (under -100 dB) over many cycles, either way round', () => {
    let worst = 0;
    for (let x = -40; x < 40; x += 0.000731) {
      worst = Math.max(worst, Math.abs(sineCycles(x) - Math.sin(2 * Math.PI * x)));
    }
    expect(worst).toBeLessThan(3e-7);
    expect(20 * Math.log10(worst)).toBeLessThan(-100);
  });
});
