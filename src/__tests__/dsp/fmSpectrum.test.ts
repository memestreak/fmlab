import { besselJ } from '../../dsp/bessel';
import { fmSpectrum, MIN_AMPLITUDE } from '../../dsp/fmSpectrum';

/** The amplitude of the line at `freq`, or 0 when there is none. */
function ampAt(lines: ReturnType<typeof fmSpectrum>, freq: number): number {
  return lines.find(l => Math.abs(l.freq - freq) < 1e-6)?.amp ?? 0;
}

describe('fmSpectrum', () => {
  it('is the bare carrier when the index is 0', () => {
    expect(fmSpectrum(1, 0)).toEqual([{ freq: 1, amp: 1 }]);
  });

  it('puts sideband n at 1 + n * ratio with amplitude J_n(I)', () => {
    // Ratio 0.1 keeps every audible sideband above zero: nothing folds.
    const lines = fmSpectrum(0.1, 1);
    expect(ampAt(lines, 1)).toBeCloseTo(besselJ(0, 1), 10);
    expect(ampAt(lines, 1.2)).toBeCloseTo(besselJ(2, 1), 10);
    expect(ampAt(lines, 0.9)).toBeCloseTo(besselJ(-1, 1), 10);
    expect(ampAt(lines, 0.7)).toBeCloseTo(besselJ(-3, 1), 10);
  });

  it('folds a negative frequency to positive with its sign flipped', () => {
    // Ratio 3: sideband -1 is at 1 - 3 = -2, and nothing else lands on 2.
    const lines = fmSpectrum(3, 1);
    expect(ampAt(lines, 2)).toBeCloseTo(-besselJ(-1, 1), 10);
    expect(ampAt(lines, 2)).toBeGreaterThan(0);
  });

  it('sums the lines that coincide at ratio 1', () => {
    const lines = fmSpectrum(1, 2);
    // The carrier and the folded sideband -2: J0(2) - J2(2).
    expect(ampAt(lines, 1)).toBeCloseTo(-0.129, 3);
    // Sideband 1 and the folded sideband -3: J1(2) + J3(2).
    expect(ampAt(lines, 2)).toBeCloseTo(besselJ(1, 2) + besselJ(3, 2), 10);
  });

  it('drops the sideband that lands on zero', () => {
    const lines = fmSpectrum(1, 2);
    expect(lines.every(l => l.freq > 0)).toBe(true);
  });

  it('makes only odd harmonics at ratio 2', () => {
    const lines = fmSpectrum(2, 3);
    expect(lines.length).toBeGreaterThan(3);
    for (const { freq } of lines) {
      expect(Math.round(freq) % 2).toBe(1);
      expect(freq).toBeCloseTo(Math.round(freq), 6);
    }
  });

  it('adds up to the carrier when the modulator stands still', () => {
    // Ratio 0 puts every sideband on the carrier, and the J_n sum to 1.
    const lines = fmSpectrum(0, 4);
    expect(lines).toHaveLength(1);
    expect(lines[0].amp).toBeCloseTo(1, 3);
  });

  it('returns lines in ascending frequency, none below the floor', () => {
    const lines = fmSpectrum(1.4, 6);
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].freq).toBeGreaterThan(lines[i - 1].freq);
    }
    expect(lines.every(l => Math.abs(l.amp) >= MIN_AMPLITUDE)).toBe(true);
  });
});
