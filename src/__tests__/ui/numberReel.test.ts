import { drumPlaces, reelKey, reelStep, slotOf } from '../../ui/numberReel';

describe('the number reel', () => {
  it('steps a tenth at a time, held from off to 100 %', () => {
    expect(reelStep(0.3, 1)).toBeCloseTo(0.4, 9);
    expect(reelStep(0.3, -2)).toBeCloseTo(0.1, 9);
    expect(reelStep(0, -1)).toBe(0);
    expect(reelStep(1, 1)).toBe(1);
    expect(reelStep(0.9, 5)).toBe(1);
  });

  it('turns from a share between stops to the next stop that way', () => {
    const ams1 = 4342338 / 2 ** 24;
    expect(reelStep(ams1, 1)).toBeCloseTo(0.3, 9);
    expect(reelStep(ams1, -1)).toBeCloseTo(0.2, 9);
    expect(reelStep(ams1, 2)).toBeCloseTo(0.4, 9);
    expect(reelStep(ams1, 0)).toBe(ams1);
  });

  it('answers the keys a slider does, and leaves Space to the page', () => {
    expect(reelKey(0.5, 'ArrowUp')).toBeCloseTo(0.6, 9);
    expect(reelKey(0.5, 'ArrowRight')).toBeCloseTo(0.6, 9);
    expect(reelKey(0.5, 'ArrowDown')).toBeCloseTo(0.4, 9);
    expect(reelKey(0.5, 'PageUp')).toBeCloseTo(0.8, 9);
    expect(reelKey(0.5, 'PageDown')).toBeCloseTo(0.2, 9);
    expect(reelKey(0.5, 'Home')).toBe(0);
    expect(reelKey(0.5, 'End')).toBe(1);
    expect(reelKey(0.5, ' ')).toBeNull();
  });
});

describe('the number reel\'s drum', () => {
  it('gives a value between stops a slot of its own', () => {
    const places = drumPlaces(0.26);
    expect(places).toHaveLength(12);
    expect(places[2]).toBe(2);
    expect(places[3]).toBeCloseTo(2.6, 9);
    expect(places[4]).toBe(3);
    // 26 % is in the middle when it is the value; 30 % one slot below.
    expect(slotOf(places, 2.6)).toBeCloseTo(3, 9);
    expect(slotOf(places, 3)).toBe(4);
    // Halfway from 26 % to 30 %, halfway between their slots.
    expect(slotOf(places, 2.8)).toBeCloseTo(3.5, 9);
  });

  it('has only the eleven stops for a value on one', () => {
    expect(drumPlaces(0.3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(slotOf(drumPlaces(0.3), 3)).toBe(3);
  });
});
