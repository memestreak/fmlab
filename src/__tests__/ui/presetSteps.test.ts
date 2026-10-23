import { PRESET_ARROW_STEPS, PRESET_STEP_KEYS } from '../../ui/chapterView';
import { stepPreset } from '../../ui/presetGrid';

// Jeremy, 2026-10-23: the header's preset up and down keys were "wired in
// reverse". Up goes on to the next voice, down back to the one before.
describe('the preset\'s up and down keys', () => {
  it('are ˄ then ˅, ˄ on and ˅ back', () => {
    // ‹ turned a quarter points up; › down.
    expect(PRESET_STEP_KEYS.map(k => k.glyph)).toEqual(['‹', '›']);
    expect(PRESET_STEP_KEYS.map(k => [k.label, k.steps])).toEqual([
      ['Next preset', 1],
      ['Previous preset', -1],
    ]);
    // From A11 (index 10): ˄ to A12, ˅ to A10.
    const [up, down] = PRESET_STEP_KEYS;
    expect(stepPreset(10, up.steps, 64)).toBe(11);
    expect(stepPreset(10, down.steps, 64)).toBe(9);
  });

  it('go as the arrow keys do: up on, down back; right on, left back', () => {
    expect(PRESET_ARROW_STEPS.ArrowUp).toBe(PRESET_STEP_KEYS[0].steps);
    expect(PRESET_ARROW_STEPS.ArrowDown).toBe(PRESET_STEP_KEYS[1].steps);
    expect(PRESET_ARROW_STEPS.ArrowRight).toBe(1);
    expect(PRESET_ARROW_STEPS.ArrowLeft).toBe(-1);
  });

  it('go round both ends, across the banks', () => {
    expect(stepPreset(63, PRESET_STEP_KEYS[0].steps, 64)).toBe(0);
    expect(stepPreset(0, PRESET_STEP_KEYS[1].steps, 64)).toBe(63);
    // A32 on to B1.
    expect(stepPreset(31, PRESET_STEP_KEYS[0].steps, 64)).toBe(32);
  });
});
