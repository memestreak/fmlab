import { heldOperator, levelScalingDb, SCALING_DEPTH } from '../../dsp/dx7';
import { depthAt, FIRST_KEY, keyAtX, LAST_KEY, xOfKey } from '../../viz/keyScalingPlot';

describe('the keyboard curve', () => {
  it('runs from the lowest C to the highest across the drawing', () => {
    expect(keyAtX(120, 0)).toBe(FIRST_KEY);
    expect(keyAtX(120, 120)).toBe(LAST_KEY);
    expect(keyAtX(120, xOfKey(120, 60))).toBe(60);
  });

  it('sets a side\'s depth from how high it is dragged at that end', () => {
    const op = heldOperator(1, 0);
    // Dragged above the line, louder; below it, quieter.
    const up = depthAt(op, 'right', 32, 2);
    const down = depthAt(op, 'right', 32, 30);
    expect(up).toBeGreaterThan(0);
    expect(down).toBeLessThan(0);
    expect(down).toBeGreaterThanOrEqual(SCALING_DEPTH.min);
    // And the curve then reaches about where it was dragged.
    const scaled = { ...op, right: { curve: 'lin' as const, depth: down } };
    expect(levelScalingDb(scaled, LAST_KEY)).toBeLessThan(0);
  });
});
