import { besselJ } from '../../dsp/bessel';

describe('besselJ', () => {
  it('matches tabulated values', () => {
    expect(besselJ(1, 2)).toBeCloseTo(0.5767, 4);
    expect(besselJ(3, 8)).toBeCloseTo(-0.2911, 4);
    expect(besselJ(0, 2)).toBeCloseTo(0.2239, 4);
    expect(besselJ(2, 2)).toBeCloseTo(0.3528, 4);
  });

  it('has its first zero of J0 at 2.405', () => {
    expect(Math.abs(besselJ(0, 2.405))).toBeLessThan(1e-3);
  });

  it('is 1 at the origin for order 0 and 0 for every other order', () => {
    expect(besselJ(0, 0)).toBe(1);
    expect(besselJ(1, 0)).toBe(0);
    expect(besselJ(5, 0)).toBe(0);
  });

  it('reflects a negative order: J_-n = (-1)^n J_n', () => {
    expect(besselJ(-1, 2)).toBeCloseTo(-besselJ(1, 2), 12);
    expect(besselJ(-2, 2)).toBeCloseTo(besselJ(2, 2), 12);
    expect(besselJ(-3, 8)).toBeCloseTo(-besselJ(3, 8), 12);
  });

  it('reflects a negative argument: J_n(-x) = (-1)^n J_n(x)', () => {
    expect(besselJ(1, -2)).toBeCloseTo(-besselJ(1, 2), 12);
    expect(besselJ(2, -2)).toBeCloseTo(besselJ(2, 2), 12);
  });

  // J0^2 + 2 (J1^2 + J2^2 + ...) = 1: modulation moves power between the
  // sidebands without adding any. It also checks the series where its
  // terms are largest.
  it.each([0.5, 5, 12, 20])('conserves power at x = %s', x => {
    let power = besselJ(0, x) ** 2;
    for (let n = 1; n <= 60; n++) {
      power += 2 * besselJ(n, x) ** 2;
    }
    expect(power).toBeCloseTo(1, 6);
  });

  it('rejects an order that is not an integer', () => {
    expect(() => besselJ(0.5, 1)).toThrow(RangeError);
  });
});
