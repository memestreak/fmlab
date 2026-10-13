import { fmSpectrum } from '../../dsp/fmSpectrum';
import { DEFAULTS } from '../../model/lab';
import { describeSpectrum } from '../../ui/figures';
import { axisEnd } from '../../viz/spectrumPlot';

describe('axisEnd', () => {
  it('is 8 carriers for the default patch', () => {
    expect(axisEnd(1, 2)).toBe(8);
  });

  it('grows to hold the sidebands Carson counts, plus one', () => {
    // Ratio 2, index 5: sidebands out to 1 + 2 * 7 = 15.
    expect(axisEnd(2, 5)).toBe(16);
    expect(axisEnd(8, 2)).toBe(64);
  });

  it('holds still while the index moves a little', () => {
    expect(axisEnd(1, 2.4)).toBe(axisEnd(1, 2));
  });

  it('stops at its widest for the most extreme patch', () => {
    expect(axisEnd(8, 10)).toBe(128);
    expect(axisEnd(8, 100)).toBe(128);
  });
});

describe('describeSpectrum', () => {
  it('says what the default patch looks like', () => {
    const text = describeSpectrum(DEFAULTS, fmSpectrum(1, 2));
    expect(text).toContain('ratio 1.00, index 2.00');
    expect(text).toContain('the strongest at 2 times the carrier');
    expect(text).toContain('1 with negative phase');
  });

  it('counts a lone carrier as one partial', () => {
    const state = { ...DEFAULTS, index: 0 };
    expect(describeSpectrum(state, fmSpectrum(1, 0))).toContain('1 partial,');
  });
});
