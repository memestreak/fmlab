import { chapterById, CHAPTERS } from '../../chapters';
import { DEFAULTS, type LabState } from '../../model/lab';
import { describeSpectrum, describeWaveform } from '../../ui/figures';
import { plotArea } from '../../viz/plot';
import {
  axisEnd,
  axisSpan,
  hzAxisEnd,
  spectrumOf,
} from '../../viz/spectrumPlot';
import { hzTicks, msTicks, spectrumTicks } from '../../viz/ticks';
import { REAL_SECONDS } from '../../viz/waveformPlot';

/** Chapter 1 as it opens, with the carrier wherever the test puts it. */
const chapter1 = (carrierHz: number): LabState => ({
  ...DEFAULTS,
  ...chapterById('sine')!.patch,
  carrierHz,
});

// Jeremy's report, 2026-10-13: in chapter 1 the frequency under the
// spectrum did not seem to change with the Carrier slider. The axis was in
// multiples of the carrier, so the stem stood at "1" wherever the slider
// was, and only a second row of small numbers moved.
describe('chapter 1 follows the Carrier slider', () => {
  const WIDTH = 660;
  const { left, right } = plotArea(WIDTH, 0);
  /** Where the single stem is drawn, in pixels, for a state. */
  const stemX = (state: LabState) => {
    const [line] = spectrumOf(state);
    return left + (line.freq / axisSpan(state)) * (right - left);
  };

  it('is in real units, and is the only chapter that is', () => {
    expect(CHAPTERS.filter(c => c.patch.realUnits).map(c => c.id)).toEqual(['sine']);
  });

  it('moves the stem when the carrier moves', () => {
    expect(stemX(chapter1(440))).toBeGreaterThan(stemX(chapter1(220)) + 50);
    expect(stemX(chapter1(110))).toBeLessThan(stemX(chapter1(220)) - 20);
  });

  it('puts the stem at the carrier\'s frequency on an axis in Hz', () => {
    // A quarter of the way along a 0 to 1000 Hz axis, and so on.
    const at = (hz: number) => (stemX(chapter1(hz)) - left) / (right - left);
    expect(at(250)).toBeCloseTo(0.25, 9);
    expect(at(880)).toBeCloseTo(0.88, 9);
  });

  it('keeps the axis where it is while the carrier moves', () => {
    const { ratio, index } = chapter1(220);
    expect(hzAxisEnd(ratio, index)).toBe(1000);
    for (const hz of [55, 220, 880]) {
      expect(axisSpan(chapter1(hz)) * hz).toBeCloseTo(1000, 9);
    }
  });

  it('keeps the stem on the plot at every carrier the slider reaches', () => {
    for (const hz of [55, 220, 880]) {
      expect(stemX(chapter1(hz))).toBeGreaterThan(left);
      expect(stemX(chapter1(hz))).toBeLessThanOrEqual(right);
    }
  });

  it('says the carrier\'s frequency in both figures\' descriptions', () => {
    const low = chapter1(220);
    const high = chapter1(440);
    expect(describeSpectrum(low, spectrumOf(low))).toContain('the strongest at 220.0 Hz');
    expect(describeSpectrum(high, spectrumOf(high))).toContain('the strongest at 440.0 Hz');
    expect(describeWaveform(low)).toBe(
      'Waveform: 20 ms of the output for a 220.0 Hz carrier, ratio 1.00, index 0.00.',
    );
    expect(describeWaveform(high)).not.toBe(describeWaveform(low));
  });
});

describe('axes in real units', () => {
  it('number a frequency axis in Hz, evenly, to its end', () => {
    expect(hzTicks(1000).map(tick => tick.label)).toEqual(
      ['200', '400', '600', '800', '1000'],
    );
    expect(hzTicks(1000).every(tick => tick.sub === '')).toBe(true);
    expect(hzTicks(5000)[4]).toEqual({ at: 5000, label: '5000', sub: '' });
  });

  it('number the waveform\'s 20 ms every 5 ms', () => {
    expect(REAL_SECONDS).toBe(0.02);
    expect(msTicks(REAL_SECONDS).map(tick => tick.label)).toEqual(
      ['0', '5', '10', '15', '20'],
    );
  });

  it('make room for sidebands once there is modulation', () => {
    // Ratio 1, index 2 at the top carrier: 880 * (1 + 4) = 4400 Hz.
    expect(hzAxisEnd(1, 2)).toBe(5000);
    expect(hzAxisEnd(1, 0)).toBe(1000);
  });
});

// The other half of the report: on axes in carrier units the curve and
// stems rightly stay put, but the Hz row beneath must still follow.
describe('axes in carrier units', () => {
  it('keep the stems where they are when the carrier moves', () => {
    const low = { ...DEFAULTS, carrierHz: 220 };
    const high = { ...DEFAULTS, carrierHz: 440 };
    expect(axisSpan(high)).toBe(axisSpan(low));
    expect(axisSpan(low)).toBe(axisEnd(1, 2));
  });

  it('renumber the Hz row for the new carrier', () => {
    expect(spectrumTicks(4, 220).map(tick => tick.sub)).not.toEqual(
      spectrumTicks(4, 539).map(tick => tick.sub),
    );
    expect(spectrumTicks(4, 539)[1].sub).toBe('539');
  });
});
