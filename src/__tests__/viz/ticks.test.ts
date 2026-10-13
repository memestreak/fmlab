import {
  formatHz,
  formatMs,
  keepsLabel,
  labelStride,
  spectrumTicks,
  waveformTicks,
} from '../../viz/ticks';

describe('formatHz', () => {
  it('keeps three significant figures', () => {
    expect(formatHz(55)).toBe('55.0');
    expect(formatHz(446.4)).toBe('446');
    expect(formatHz(1760)).toBe('1.76k');
    expect(formatHz(14080)).toBe('14.1k');
    expect(formatHz(112640)).toBe('113k');
  });

  it('changes form where rounding would add a digit', () => {
    expect(formatHz(99.96)).toBe('100');
    expect(formatHz(999.6)).toBe('1.00k');
    expect(formatHz(9996)).toBe('10.0k');
    expect(formatHz(99960)).toBe('100k');
  });

  it('never needs more than five characters in the app\'s range', () => {
    // From the lowest carrier to the top of the widest axis.
    for (let hz = 55; hz <= 880 * 128; hz *= 1.01) {
      expect(formatHz(hz).length).toBeLessThanOrEqual(5);
    }
  });
});

describe('formatMs', () => {
  it('keeps three significant figures, and a bare 0', () => {
    expect(formatMs(0)).toBe('0');
    expect(formatMs(1000 / 880)).toBe('1.14');
    expect(formatMs(1000 / 220)).toBe('4.55');
    expect(formatMs(2000 / 55)).toBe('36.4');
    expect(formatMs(40000 / 220)).toBe('182');
  });
});

describe('spectrumTicks', () => {
  it('numbers the default axis 1 to 8, with each carrier multiple in Hz', () => {
    const ticks = spectrumTicks(8, 220);
    expect(ticks.map(tick => tick.label)).toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8'],
    );
    expect(ticks.map(tick => tick.sub)).toEqual(
      ['220', '440', '660', '880', '1.10k', '1.32k', '1.54k', '1.76k'],
    );
  });

  it('always has eight ticks, the last at the end of the axis', () => {
    const ticks = spectrumTicks(64, 110);
    expect(ticks).toHaveLength(8);
    expect(ticks[0].at).toBe(8);
    expect(ticks[7]).toEqual({ at: 64, label: '64', sub: '7.04k' });
  });
});

describe('waveformTicks', () => {
  it('marks the start of each carrier cycle, in cycles and ms', () => {
    expect(waveformTicks(2, 220)).toEqual([
      { at: 0, label: '0', sub: '0' },
      { at: 1, label: '1', sub: '4.55' },
      { at: 2, label: '2', sub: '9.09' },
    ]);
  });
});

describe('thinning labels', () => {
  it('keeps every label when they fit', () => {
    expect(labelStride(30, 70, 8)).toBe(1);
    expect(labelStride(30, 38, 8)).toBe(1);
  });

  it('keeps every second or third when they do not', () => {
    expect(labelStride(36, 35, 8)).toBe(2);
    expect(labelStride(36, 20, 8)).toBe(3);
  });

  it('always keeps the last label', () => {
    const kept = (stride: number) =>
      [0, 1, 2, 3, 4, 5, 6, 7].filter(i => keepsLabel(i, 8, stride));
    expect(kept(1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(kept(2)).toEqual([1, 3, 5, 7]);
    expect(kept(3)).toEqual([1, 4, 7]);
  });
});
