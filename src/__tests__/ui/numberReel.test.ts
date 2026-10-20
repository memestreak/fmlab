import { drumPlaces, placeOf, reelKey, reelStep, slotOf, wheelSteps } from '../../ui/numberReel';
import {
  DETUNE_STOPS,
  DX7_RATIO_STOPS,
  formatLevel,
  formatRatio,
  LEVEL_STOPS,
  TREMOLO_STOPS,
} from '../../ui/voiceTable';

describe('the number reel', () => {
  const tenths = TREMOLO_STOPS;

  it('steps a stop at a time, held to the ends', () => {
    expect(reelStep(tenths, 0.3, 1)).toBeCloseTo(0.4, 9);
    expect(reelStep(tenths, 0.3, -2)).toBeCloseTo(0.1, 9);
    expect(reelStep(tenths, 0, -1)).toBe(0);
    expect(reelStep(tenths, 1, 1)).toBe(1);
    expect(reelStep(tenths, 0.9, 5)).toBe(1);
  });

  it('turns from a value between stops to the next stop that way', () => {
    const ams1 = 4342338 / 2 ** 24;
    expect(reelStep(tenths, ams1, 1)).toBeCloseTo(0.3, 9);
    expect(reelStep(tenths, ams1, -1)).toBeCloseTo(0.2, 9);
    expect(reelStep(tenths, ams1, 2)).toBeCloseTo(0.4, 9);
    expect(reelStep(tenths, ams1, 0)).toBe(ams1);
    // A factory ratio of 1.41: up to 2, down to 1.
    expect(reelStep(DX7_RATIO_STOPS, 1.41, 1)).toBe(2);
    expect(reelStep(DX7_RATIO_STOPS, 1.41, -1)).toBe(1);
  });

  it('keeps a value beyond its stops until turned back in', () => {
    // A ratio of 40, from a link: past the reel's 31.
    expect(placeOf(DX7_RATIO_STOPS, 40)).toBe(DX7_RATIO_STOPS.length - 0.5);
    expect(reelStep(DX7_RATIO_STOPS, 40, 1)).toBe(40);
    expect(reelStep(DX7_RATIO_STOPS, 40, -1)).toBe(31);
  });

  it('answers the keys a slider does, and leaves Space to the page', () => {
    expect(reelKey(tenths, 0.5, 'ArrowUp', 3)).toBeCloseTo(0.6, 9);
    expect(reelKey(tenths, 0.5, 'ArrowRight', 3)).toBeCloseTo(0.6, 9);
    expect(reelKey(tenths, 0.5, 'ArrowDown', 3)).toBeCloseTo(0.4, 9);
    expect(reelKey(tenths, 0.5, 'PageUp', 3)).toBeCloseTo(0.8, 9);
    expect(reelKey(tenths, 0.5, 'PageDown', 3)).toBeCloseTo(0.2, 9);
    expect(reelKey(tenths, 0.5, 'Home', 3)).toBe(0);
    expect(reelKey(tenths, 0.5, 'End', 3)).toBe(1);
    expect(reelKey(tenths, 0.5, ' ', 3)).toBeNull();
    // Level: Page Up is 6 dB; Home is off.
    expect(reelKey(LEVEL_STOPS, -30, 'PageUp', 6)).toBe(-24);
    expect(formatLevel(reelKey(LEVEL_STOPS, -30, 'Home', 6)!)).toBe('off');
  });
});

describe('the number reel\'s drum', () => {
  it('gives a value between stops a slot of its own', () => {
    const places = drumPlaces(TREMOLO_STOPS, 0.26);
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

  it('has only its stops for a value on one', () => {
    expect(drumPlaces(TREMOLO_STOPS, 0.3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(slotOf(drumPlaces(TREMOLO_STOPS, 0.3), 3)).toBe(3);
  });
});

describe('the operator table\'s reels', () => {
  it('step the ratio through the DX7\'s coarse ratios', () => {
    expect(DX7_RATIO_STOPS[0]).toBe(0.5);
    expect(DX7_RATIO_STOPS.at(-1)).toBe(31);
    expect(formatRatio(1.41)).toBe('1.41');
    expect(formatRatio(14)).toBe('14');
  });

  it('step the detune through the DX7\'s 15 steps, as the factory voices are written', () => {
    expect(DETUNE_STOPS).toHaveLength(15);
    expect(DETUNE_STOPS[7]).toBe(0);
    expect(DETUNE_STOPS[14]).toBe(6.31);
    expect(DETUNE_STOPS[0]).toBe(-6.31);
    // A factory voice's +2.7 is a stop, not between two.
    expect(Number.isInteger(placeOf(DETUNE_STOPS, 2.7))).toBe(true);
  });

  it('step the level in whole dB from off to 0', () => {
    expect(LEVEL_STOPS).toHaveLength(74);
    expect(formatLevel(LEVEL_STOPS[0])).toBe('off');
    expect(LEVEL_STOPS[1]).toBe(-72);
    expect(LEVEL_STOPS.at(-1)).toBe(0);
    // A factory -30.75 dB sits between -31 and -30.
    expect(reelStep(LEVEL_STOPS, -30.75, 1)).toBe(-30);
  });
});

describe('the number reel\'s wheel', () => {
  it('scrolls as a page does: down (positive deltaY) is the larger value below', () => {
    expect(wheelSteps(30)).toBe(1);
    expect(wheelSteps(95)).toBe(3);
    expect(wheelSteps(-30)).toBe(-1);
    expect(wheelSteps(29)).toBe(0);
  });
});
