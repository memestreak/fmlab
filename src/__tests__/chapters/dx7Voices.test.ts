import { chapterById } from '../../chapters';
import { operatorsFromParam, operatorsParam } from '../../chapters/route';
import {
  DETUNE_CENTS,
  DX7_FEEDBACK,
  DX7_RATIO,
  LEVEL_DB,
  MAX_STAGE_SECONDS,
  RATE_SCALING,
  SCALING_DEPTH,
  SILENCE_DB,
} from '../../dsp/dx7';

const inside = (value: number, { min, max }: { min: number; max: number }) =>
  value >= min - 1e-9 && value <= max + 1e-9;

describe('the sandbox\'s voices', () => {
  const presets = chapterById('sandbox')!.presets;

  it.each(presets.map(p => [p.label, p] as const))('%s keeps every number inside its control\'s range', (_, preset) => {
    const { dxOperators, dxFeedback, algorithm } = preset.patch;
    expect(dxOperators).toHaveLength(6);
    expect(inside(dxFeedback!, DX7_FEEDBACK)).toBe(true);
    expect(algorithm).toBeGreaterThanOrEqual(1);
    for (const op of dxOperators!) {
      expect(inside(op.ratio, DX7_RATIO)).toBe(true);
      expect(inside(op.detune, DETUNE_CENTS)).toBe(true);
      if (op.level !== null) expect(inside(op.level, LEVEL_DB)).toBe(true);
      for (const time of [op.envelope.attack, op.envelope.decay1, op.envelope.decay2, op.envelope.release]) {
        expect(inside(time, { min: 0, max: MAX_STAGE_SECONDS })).toBe(true);
      }
      for (const level of [op.envelope.peak, op.envelope.brk, op.envelope.sustain]) {
        expect(inside(level, { min: SILENCE_DB, max: 0 })).toBe(true);
      }
      expect(inside(op.left.depth, SCALING_DEPTH) && inside(op.right.depth, SCALING_DEPTH)).toBe(true);
      expect(inside(op.rateScaling, RATE_SCALING)).toBe(true);
    }
    // And survives a link unchanged.
    expect(operatorsFromParam(operatorsParam(dxOperators!))).toEqual(dxOperators);
  });
});
