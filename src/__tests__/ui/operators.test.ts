import { algorithm, operatorsUsed } from '../../dsp/algorithms';
import { OP_RATIO } from '../../model/lab';
import { RATIO_STOPS, scrubTo, snapRatio, stepRatio } from '../../ui/operators';
import { diagramGeometry, operatorAt } from '../../viz/algorithmPlot';

describe('dragging in a box', () => {
  /** A ratio stop's share of the drag, in pixels: 300 across 17 stops. */
  const STOP = 300 / RATIO_STOPS.length;

  it('steps Ratio from stop to stop, a stop at a time', () => {
    expect(scrubTo('ratio', 1, 0, false)).toBe(1);
    expect(scrubTo('ratio', 1, STOP - 1, false)).toBe(1);
    expect(scrubTo('ratio', 1, STOP + 1, false)).toBe(2);
    expect(scrubTo('ratio', 1, 2 * STOP + 1, false)).toBe(3);
    expect(scrubTo('ratio', 1, -(STOP + 1), false)).toBe(0.5);
    // From between stops, the first stop along is the next one.
    expect(scrubTo('ratio', 1.41, STOP + 1, false)).toBe(2);
    expect(scrubTo('ratio', 1.41, -(STOP + 1), false)).toBe(1);
  });

  it('moves Ratio in hundredths, and slower, with Shift or Alt', () => {
    // 15.5 across 1500 px: about a hundredth a pixel.
    expect(scrubTo('ratio', 1, 10, true)).toBeCloseTo(1.1, 10);
    expect(scrubTo('ratio', 1.41, 1, true)).toBeCloseTo(1.42, 10);
  });

  it('moves Level in whole percent, five times slower when fine', () => {
    expect(scrubTo('level', 0, 100, false)).toBe(50);
    expect(scrubTo('level', 40, -20, false)).toBe(30);
    expect(scrubTo('level', 0, 100, true)).toBe(10);
  });

  it('moves Decay in tenths of a second', () => {
    expect(scrubTo('decay', 0, 100, false)).toBe(3);
    expect(scrubTo('decay', 0, 100, true)).toBe(0.6);
    expect(scrubTo('decay', 2, 7, false)).toBe(2.2);
  });

  it('stays within each range', () => {
    expect(scrubTo('level', 90, 500, false)).toBe(100);
    expect(scrubTo('level', 10, -500, false)).toBe(0);
    expect(scrubTo('decay', 5, 900, false)).toBe(6);
    expect(scrubTo('ratio', 16, 300, false)).toBe(16);
    expect(scrubTo('ratio', 0.5, -300, false)).toBe(0.5);
    expect(scrubTo('ratio', 15.9, 3000, true)).toBe(16);
  });
});

describe('the Ratio slider', () => {
  it('snaps to a half and every whole number, across the whole range', () => {
    expect(RATIO_STOPS[0]).toBe(OP_RATIO.min);
    expect(RATIO_STOPS.at(-1)).toBe(OP_RATIO.max);
    expect(RATIO_STOPS.slice(0, 4)).toEqual([0.5, 1, 2, 3]);
    expect(snapRatio(1.41)).toBe(1);
    expect(snapRatio(1.6)).toBe(2);
    expect(snapRatio(0.6)).toBe(0.5);
    expect(snapRatio(15.9)).toBe(16);
  });

  it('steps from stop to stop, and from between stops to the next one', () => {
    expect(stepRatio(1, 1)).toBe(2);
    expect(stepRatio(1, -1)).toBe(0.5);
    expect(stepRatio(1.41, 1)).toBe(2);
    expect(stepRatio(1.41, -1)).toBe(1);
    expect(stepRatio(16, 1)).toBe(16);
    expect(stepRatio(0.5, -1)).toBe(0.5);
  });
});

describe('pointing at the wiring diagram', () => {
  const SIZE = { width: 300, height: 140 };

  it('finds every operator at the centre of its box, in every algorithm', () => {
    for (let number = 1; number <= 32; number++) {
      const alg = algorithm(number);
      const { places, box, boxX, boxY } = diagramGeometry(alg, SIZE.width, SIZE.height);
      for (const op of operatorsUsed(alg)) {
        const x = boxX(places[op]) + box / 2;
        const y = boxY(places[op]) + box / 2;
        expect(operatorAt(number, SIZE.width, SIZE.height, x, y), `${number} OP${op + 1}`).toBe(op);
      }
    }
  });

  it('draws every algorithm with boxes of one size where there is room', () => {
    // The sandbox's diagram at 1440×900, 1280×800 and on a phone.
    for (const [width, height] of [[495, 233], [446, 221], [348, 187]]) {
      const sides = new Set<number>();
      for (let number = 1; number <= 32; number++) {
        const alg = algorithm(number);
        const { places, box, boxX, boxY, outY } = diagramGeometry(alg, width, height);
        sides.add(box);
        for (const op of operatorsUsed(alg)) {
          expect(boxX(places[op])).toBeGreaterThanOrEqual(0);
          expect(boxX(places[op]) + box).toBeLessThanOrEqual(width);
          // Room above the top row for the feedback loop.
          expect(boxY(places[op]) - box * 0.35).toBeGreaterThanOrEqual(0);
        }
        expect(outY).toBeLessThanOrEqual(height - 14);
      }
      expect(sides.size, `${width}×${height}`).toBe(1);
    }
  });

  it('fits each wiring on its own where the diagram is short', () => {
    // The chapter lab's: one box size for all would be too small to read.
    const one = diagramGeometry(algorithm(32), 410, 110).box;
    const stack = diagramGeometry(algorithm(1), 410, 110).box;
    expect(one).toBeGreaterThan(stack);
    expect(stack).toBeGreaterThanOrEqual(12);
  });

  it('finds nothing away from the boxes', () => {
    expect(operatorAt(1, SIZE.width, SIZE.height, 2, 2)).toBeNull();
    expect(operatorAt(1, SIZE.width, SIZE.height, SIZE.width - 2, SIZE.height - 2)).toBeNull();
  });
});
