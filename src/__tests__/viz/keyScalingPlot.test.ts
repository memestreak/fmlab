import { heldOperator, levelScalingDb, SCALING_DEPTH } from '../../dsp/dx7';
import { depthAt, FIRST_KEY, keyAt, keyAtX, keysArea, keyX, LAST_KEY, xOfKey } from '../../viz/keyScalingPlot';

describe('the keyboard curve', () => {
  it('runs a piano\'s 88 keys, A0 to C8, across the drawing', () => {
    expect(FIRST_KEY).toBe(21);
    expect(LAST_KEY).toBe(108);
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

  it('leaves the large drawing room for its dB and its keys\' names', () => {
    const area = keysArea(600, 160, true);
    expect(area.left).toBeGreaterThan(0);
    expect(area.keysTop + area.keysHeight).toBeLessThan(160);
    expect(area.bottom).toBeLessThan(area.keysTop);
    // A key's x and the key under that x agree, margins and all.
    for (const key of [FIRST_KEY, 48, 60, 77, LAST_KEY]) expect(keyAt(area, keyX(area, key))).toBe(key);
  });

  it('reads a depth dragged in the large drawing the same way', () => {
    const op = heldOperator(1, 0);
    const area = keysArea(600, 160, true);
    expect(depthAt(op, 'left', area, area.top)).toBeGreaterThan(0);
    expect(depthAt(op, 'left', area, area.bottom)).toBeLessThan(0);
  });
});
