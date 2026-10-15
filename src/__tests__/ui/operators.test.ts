import { algorithm, operatorsUsed } from '../../dsp/algorithms';
import { OP_RATIO } from '../../model/lab';
import { RATIO_STOPS, snapRatio, stepRatio } from '../../ui/operators';
import { diagramGeometry, operatorAt } from '../../viz/algorithmPlot';

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

  it('finds nothing away from the boxes', () => {
    expect(operatorAt(1, SIZE.width, SIZE.height, 2, 2)).toBeNull();
    expect(operatorAt(1, SIZE.width, SIZE.height, SIZE.width - 2, SIZE.height - 2)).toBeNull();
  });
});
