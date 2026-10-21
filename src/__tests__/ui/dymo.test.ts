import { strike, STRIKE_DROP, STRIKE_TILT } from '../../ui/dymo';

describe('a Dymo label', () => {
  it('strikes each letter a hair off true, within the die\'s limits', () => {
    for (const word of ['Voice', 'Operators', 'Octave']) {
      for (let i = 0; i < word.length; i++) {
        const { drop, tilt } = strike(word, i);
        expect(Math.abs(drop)).toBeLessThanOrEqual(STRIKE_DROP);
        expect(Math.abs(tilt)).toBeLessThanOrEqual(STRIKE_TILT);
      }
    }
    expect(STRIKE_DROP).toBe(0.14);
    expect(STRIKE_TILT).toBe(0.23);
  });

  it('looks the same every time, and differs from letter to letter', () => {
    expect(strike('Voice', 2)).toEqual(strike('Voice', 2));
    expect(strike('Voice', 1)).not.toEqual(strike('Voice', 2));
  });
});
