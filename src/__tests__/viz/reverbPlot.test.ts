import { bandEnvelopes, fromStart, reverbResponse } from '../../dsp/reverbResponse';
import { DEFAULT_SETTINGS, parseSettings } from '../../model/settings';
import { describeReverb, formatGain, type ReverbCurves, timeAt, timeStep, wetDb } from '../../viz/reverbPlot';

// The Reverb tab's screen (Jeremy, 2026-10-22): the plate's lows and highs
// after a click, from the real plate.

const RATE = 48000;

/** The slope of a curve, in dB a second, by least squares over its points from `from` to `to` seconds. */
function slope(curve: Float32Array, span: number, from: number, to: number): number {
  const relative = fromStart(curve, span);
  const points: [number, number][] = [];
  relative.forEach((db, i) => {
    const t = (i * span) / relative.length;
    if (t >= from && t <= to) points.push([t, db]);
  });
  const mt = points.reduce((a, [t]) => a + t, 0) / points.length;
  const md = points.reduce((a, [, d]) => a + d, 0) / points.length;
  const num = points.reduce((a, [t, d]) => a + (t - mt) * (d - md), 0);
  const den = points.reduce((a, [t]) => a + (t - mt) ** 2, 0);
  return num / den;
}

/** A seeded noise, so the test is the same every run. */
function noise(n: number, seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return (state / 2 ** 32) * 2 - 1;
  };
}

describe('the reverb screen\'s curves', () => {
  it('fall at a known slope, within 1 dB a second', () => {
    // White noise falling 40 dB a second, for 2 s.
    const n = 2 * RATE;
    const burst = (seed: number) => {
      const next = noise(n, seed);
      return Float32Array.from({ length: n }, (_, i) => next() * 10 ** ((-40 * i) / RATE / 20));
    };
    const { lows, highs } = bandEnvelopes(burst(1), burst(2), RATE, 200, 2);
    expect(Math.abs(slope(lows, 2, 0.3, 1.5) + 40)).toBeLessThan(1);
    expect(Math.abs(slope(highs, 2, 0.3, 1.5) + 40)).toBeLessThan(1);
  });

  it('put a signal with nothing over 4 kHz at least 30 dB lower in the highs', () => {
    const n = RATE;
    const low = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 100 * i) / RATE));
    const { lows, highs } = bandEnvelopes(low, low, RATE, 50, 1);
    for (let i = 0; i < 40; i++) expect(highs[i]).toBeLessThan(lows[i] - 30);
  });

  it('show a darker Tone as highs that fall sooner, on the real plate at 1.5 s', () => {
    const span = 1.25 * 1.5;
    const dark = reverbResponse({ seconds: 1.5, tone: 0, columns: 150, span });
    const bright = reverbResponse({ seconds: 1.5, tone: 100, columns: 150, span });
    const darkAt = timeAt(dark.highs, span, -40)!;
    const brightAt = timeAt(bright.highs, span, -40)!;
    expect(darkAt).toBeLessThan(brightAt);
  }, 30_000);

  it('start at the wet\'s level for the Mix: -6.0 dB at 25 %, 0 from 50 %, none at 0', () => {
    expect(wetDb(25)).toBeCloseTo(-6.02, 2);
    expect(formatGain(0.5)).toBe('-6.0 dB');
    expect(wetDb(50)).toBe(0);
    expect(wetDb(80)).toBe(0);
    expect(wetDb(0)).toBeNull();
    expect(formatGain(0)).toBe('off');
    expect(formatGain(1)).toBe('0 dB');
  });

  it('tick time at a round step, four to six of them', () => {
    for (const span of [0.3, 1.9, 6.3, 25.5]) {
      const step = timeStep(span);
      expect(span / step).toBeLessThanOrEqual(6);
      expect(span / step).toBeGreaterThanOrEqual(2.5);
    }
  });
});

describe('the reverb screen in words', () => {
  const view = { on: true, seconds: 1.5, mix: 25, tone: 70, preDelay: 0 };
  it('says off, or how it falls and the dry and wet', () => {
    expect(describeReverb({ ...view, on: false }, null)).toBe('Reverb off');
    expect(describeReverb(view, null)).toBe('Reverb on: falls 60 dB in 1.5 s; dry 0 dB, wet -6.0 dB.');
  });

  it('says how the highs fall against the lows, from the curves', () => {
    const span = 1.25 * 1.5;
    const columns = 100;
    const line = (dbPerSecond: number) => Float32Array.from({ length: columns }, (_, i) => (dbPerSecond * i * span) / columns);
    const curves = (lows: number, highs: number): ReverbCurves => ({ lows: line(lows), highs: line(highs), span });
    expect(describeReverb(view, curves(-40, -80))).toContain('the highs fall faster than the lows');
    expect(describeReverb(view, curves(-40, -41))).toContain('the highs fall about as fast as the lows');
    expect(describeReverb({ ...view, preDelay: 0.04 }, curves(-40, -80))).toContain('after 40 ms');
  });
});

describe('the reverb\'s settings, set on its tab', () => {
  it('still load as saved, Pre-delay among them, held in range', () => {
    const saved = parseSettings(
      JSON.stringify({ reverb: 'on', reverbDecay: 3.04, reverbMix: 40, reverbTone: 20, reverbPreDelay: 900 }),
    );
    expect(saved).toEqual({
      ...DEFAULT_SETTINGS,
      reverb: 'on',
      reverbDecay: 3,
      reverbMix: 40,
      reverbTone: 20,
      reverbPreDelay: 500,
    });
    expect(DEFAULT_SETTINGS.reverbPreDelay).toBe(0);
  });
});
