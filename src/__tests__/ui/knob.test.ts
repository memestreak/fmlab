import { knobAfterKey, knobPosition, knobValue } from '../../ui/knob';

describe('a knob', () => {
  const level = { min: -96, max: 0 };
  const time = { min: 0.001, max: 40, log: true };

  it('turns evenly through a level', () => {
    expect(knobPosition(level, -48)).toBe(0.5);
    expect(knobValue(level, 0.25)).toBe(-72);
  });

  it('turns through a time on a log scale: equal turns, equal ratios', () => {
    const half = knobValue(time, 0.5);
    expect(half).toBeCloseTo(Math.sqrt(0.001 * 40), 9);
    expect(knobValue(time, 0.75) / half).toBeCloseTo(half / knobValue(time, 0.25), 9);
    expect(knobPosition(time, knobValue(time, 0.3))).toBeCloseTo(0.3, 12);
    // Nothing at all sits at the bottom.
    expect(knobPosition(time, 0)).toBe(0);
  });

  it('stays inside its ends', () => {
    expect(knobValue(level, 2)).toBe(0);
    expect(knobPosition(level, 10)).toBe(1);
  });

  it('answers the keys a slider does', () => {
    expect(knobAfterKey(0.5, 'ArrowUp')).toBeCloseTo(0.51, 12);
    expect(knobAfterKey(0.5, 'ArrowLeft')).toBeCloseTo(0.49, 12);
    expect(knobAfterKey(0.5, 'PageUp')).toBeCloseTo(0.6, 12);
    expect(knobAfterKey(0.95, 'PageUp')).toBe(1);
    expect(knobAfterKey(0.5, 'Home')).toBe(0);
    expect(knobAfterKey(0.5, 'End')).toBe(1);
    expect(knobAfterKey(0.5, 'a')).toBeNull();
  });
});
