import { DEFAULTS, type LabState } from '../../model/lab';
import { describeSpectrum } from '../../ui/figures';
import { amplitudeFromDb } from '../../viz/liveSpectrum';
import {
  ampDb,
  DB_FLOOR,
  dbToShare,
  hzToShare,
  isLogSpectrum,
  keptLabels,
  LOG_HZ_TICKS,
} from '../../viz/spectrumPlot';

// The sandbox's spectrum on log frequency and dB axes (Jeremy, 2026-10-22).

describe('the sandbox spectrum\'s axes', () => {
  it('runs from 20 Hz to 20 kHz on a log scale, 632 Hz in the middle', () => {
    expect(hzToShare(20)).toBe(0);
    expect(hzToShare(20000)).toBeCloseTo(1, 12);
    expect(hzToShare(Math.sqrt(20 * 20000))).toBeCloseTo(0.5, 12);
    expect(hzToShare(632)).toBeCloseTo(0.5, 3);
    // Every octave the same width.
    expect(hzToShare(880) - hzToShare(440)).toBeCloseTo(hzToShare(220) - hzToShare(110), 12);
  });

  it('reads a full sine as 0 dB, at the top, and clips below the floor', () => {
    expect(ampDb(1)).toBe(0);
    expect(ampDb(-0.5)).toBeCloseTo(-6.02, 2);
    expect(ampDb(0)).toBe(-Infinity);
    expect(dbToShare(0)).toBe(1);
    expect(dbToShare(3)).toBe(1);
    expect(dbToShare(DB_FLOOR)).toBe(0);
    expect(dbToShare(-36)).toBeCloseTo(0.5, 12);
    expect(dbToShare(-80)).toBeNull();
    expect(dbToShare(-Infinity)).toBeNull();
  });

  it('puts the measured trace on the same scale: a full sine\'s bin is 0 dB', () => {
    // A sine of amplitude 1 peaks at 0.42 / 2 in the analyser.
    expect(ampDb(amplitudeFromDb(20 * Math.log10(0.21)))).toBeCloseTo(0, 9);
  });

  it('ticks at 20, 50, 100 ... 20k, thinned where they would touch, keeping 20k', () => {
    expect(LOG_HZ_TICKS.map(tick => tick.label)).toEqual(['20', '50', '100', '200', '500', '1k', '2k', '5k', '10k', '20k']);
    const width = 300;
    const xs = LOG_HZ_TICKS.map(tick => hzToShare(tick.hz) * width);
    const widths = LOG_HZ_TICKS.map(tick => tick.label.length * 7);
    expect(keptLabels(xs, widths, 6)).toEqual(xs.map(() => true));
    const narrow = LOG_HZ_TICKS.map(tick => hzToShare(tick.hz) * 120);
    const kept = keptLabels(narrow, widths, 6);
    expect(kept.at(-1)).toBe(true);
    expect(kept.filter(Boolean).length).toBeLessThan(kept.length);
    // No two kept labels touch.
    const boxes = narrow.flatMap((x, i) => (kept[i] ? [[x - widths[i] / 2, x + widths[i] / 2]] : []));
    boxes.slice(1).forEach(([from], i) => expect(from).toBeGreaterThanOrEqual(boxes[i][1] + 6));
  });

  it('is the sandbox\'s only, and says its axes and lines in words', () => {
    const sandbox: LabState = { ...DEFAULTS, chapter: 'sandbox', mode: 'ops', carrierHz: 220 };
    expect(isLogSpectrum(sandbox)).toBe(true);
    expect(isLogSpectrum({ ...DEFAULTS, chapter: 'sine' })).toBe(false);
    const text = describeSpectrum(sandbox, [
      { freq: 1, amp: 0.5 },
      { freq: 2, amp: -0.1 },
      { freq: 3, amp: 1e-5 },
      { freq: 200, amp: 0.4 },
    ]);
    expect(text).toBe(
      'Spectrum, frequency on a log scale from 20 Hz to 20 kHz, level in dB: 2 partials above -72 dB, ' +
        'the strongest at 220 Hz, -6 dB, 1 with negative phase.',
    );
  });
});
