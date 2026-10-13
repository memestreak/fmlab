import { DEFAULTS, type LabState } from '../../model/lab';
import { describeWaveform } from '../../ui/figures';
import { formatRate } from '../../ui/sliders';
import { spectrumOf } from '../../viz/spectrumPlot';
import { waveformTicks } from '../../viz/ticks';
import { cyclesShown } from '../../viz/waveformPlot';

const fm = (modHz: number, deviationHz = 20): LabState => ({
  ...DEFAULTS,
  mode: 'fm',
  carrierHz: 220,
  modHz,
  deviationHz,
});

describe('cyclesShown', () => {
  it('is two carrier cycles for phase modulation, whatever the ratio', () => {
    expect(cyclesShown(DEFAULTS)).toBe(2);
    expect(cyclesShown({ ...DEFAULTS, ratio: 0.25 })).toBe(2);
  });

  it('is two cycles of the modulator for true FM, to show the wobble', () => {
    // 22 Hz on 220 Hz: one wobble is ten carrier cycles.
    expect(cyclesShown(fm(22))).toBeCloseTo(20, 9);
  });

  it('stops at forty carrier cycles for a slow vibrato', () => {
    expect(cyclesShown(fm(5))).toBe(40);
    expect(cyclesShown(fm(0.5))).toBe(40);
  });

  it('never shows less than two carrier cycles', () => {
    expect(cyclesShown(fm(880))).toBe(2);
  });
});

describe('waveformTicks over a long window', () => {
  it('numbers forty cycles in fives', () => {
    const ticks = waveformTicks(40, 220);
    expect(ticks.map(tick => tick.label)).toEqual(
      ['0', '5', '10', '15', '20', '25', '30', '35', '40'],
    );
    expect(ticks[8].sub).toBe('182');
  });

  it('stops at the last whole step inside a window that is not whole', () => {
    expect(waveformTicks(12.5, 220).map(tick => tick.at)).toEqual(
      [0, 2, 4, 6, 8, 10, 12],
    );
  });
});

describe('spectrumOf', () => {
  it('has signed lines for phase modulation', () => {
    expect(spectrumOf(DEFAULTS).some(line => line.amp < 0)).toBe(true);
  });

  it('has magnitudes, clustered on the carrier, for a vibrato', () => {
    const lines = spectrumOf(fm(5));
    expect(lines.every(line => line.amp > 0)).toBe(true);
    expect(lines.every(line => Math.abs(line.freq - 1) < 0.25)).toBe(true);
  });

  it('is one line for the single sine of chapter 1', () => {
    expect(spectrumOf({ ...DEFAULTS, index: 0 })).toEqual([{ freq: 1, amp: 1 }]);
  });
});

describe('describing the figures', () => {
  it('formats a rate with the decimals it needs', () => {
    expect(formatRate(0.5)).toBe('0.50 Hz');
    expect(formatRate(5)).toBe('5.00 Hz');
    expect(formatRate(12.34)).toBe('12.3 Hz');
    expect(formatRate(440)).toBe('440 Hz');
  });

  it('describes a vibrato in the sliders\' own words', () => {
    expect(describeWaveform(fm(5))).toBe(
      'Waveform: 40 carrier cycles of the output for a 220 Hz carrier, ' +
        'modulator at 5.00 Hz, deviation 20 Hz, with the modulator behind it.',
    );
  });

  it('leaves the modulator out when it is not drawn', () => {
    const text = describeWaveform({ ...DEFAULTS, index: 0, showModulator: false });
    expect(text).toBe(
      'Waveform: 2 carrier cycles of the output for ratio 1.00, index 0.00.',
    );
  });
});
