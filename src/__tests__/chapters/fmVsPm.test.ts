import { chapterByNumber, CHAPTERS } from '../../chapters';
import { trueFmSpectrum } from '../../dsp/fmSpectrum';
import { asFm, asPm, DEFAULTS, type LabState } from '../../model/lab';
import { axisSpan, spectrumOf } from '../../viz/spectrumPlot';

const chapter9 = chapterByNumber(9)!;
const opened: LabState = { ...DEFAULTS, ...chapter9.patch, chapter: 9 };

describe('chapter 9, FM versus PM', () => {
  it('is the last chapter, and the only one comparing', () => {
    expect(CHAPTERS[CHAPTERS.length - 1]).toBe(chapter9);
    expect(CHAPTERS.filter(c => c.patch.compare).map(c => c.number)).toEqual([9]);
  });

  it('shows the two spectra and offers ratio and index', () => {
    expect(Object.keys(chapter9.figures)).toEqual(['spectrum', 'compare']);
    expect(chapter9.controls).toEqual(['volume', 'ratio', 'index']);
    expect(opened.mode).toBe('pm');
  });

  it('opens with the FM sound matched to the PM one', () => {
    const fm = asFm(opened);
    expect(opened.modHz).toBe(fm.modHz);
    expect(opened.deviationHz).toBe(fm.deviationHz);
  });
});

describe('asPm and asFm', () => {
  it('turn the patch into one or the other', () => {
    const fm = asFm({ ...opened, mode: 'pm' });
    expect(fm.mode).toBe('fm');
    expect(asPm(fm).mode).toBe('pm');
  });

  it("match FM to PM's index at ratio 1, and thin it as the ratio grows", () => {
    for (const ratio of [0.5, 1, 2, 4]) {
      const fm = asFm({ ...opened, ratio, index: 2 });
      expect(fm.modHz).toBeCloseTo(ratio * fm.carrierHz, 9);
      expect(fm.deviationHz / fm.modHz).toBeCloseTo(2 / ratio, 9);
    }
  });

  it('predicts FM as the Bessel spectrum of index over ratio', () => {
    const state = { ...opened, ratio: 3, index: 3 };
    const lines = spectrumOf(asFm(state));
    const expected = trueFmSpectrum(3, 1);
    expect(lines.map(l => l.freq)).toEqual(expected.map(l => l.freq));
  });

  it('keeps PM as rich as Index says whatever the ratio', () => {
    const at = (ratio: number) => spectrumOf(asPm({ ...opened, ratio, index: 3 })).length;
    const fmAt = (ratio: number) => spectrumOf(asFm({ ...opened, ratio, index: 3 })).length;
    expect(at(4)).toBeGreaterThanOrEqual(at(1) - 2);
    expect(fmAt(4)).toBeLessThan(at(4));
  });

  it('draws both on one axis, wide enough for either', () => {
    const slow = { ...opened, ratio: 0.5, index: 4 };
    expect(axisSpan(asPm(slow))).toBe(axisSpan(asFm(slow)));
    const fast = { ...opened, ratio: 4, index: 4 };
    expect(axisSpan(asPm(fast))).toBe(axisSpan(asFm(fast)));
  });
});
