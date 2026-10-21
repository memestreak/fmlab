import { chapterById } from '../../chapters';
import { DEFAULTS } from '../../model/lab';
import { formatWheel, WHEEL_TRAVEL_PX, wheelAfterDrag, wheelAfterKey, wheelAfterScroll } from '../../ui/modWheel';

describe('the mod wheel', () => {
  it('opens at 0', () => {
    expect(DEFAULTS.modWheel).toBe(0);
  });

  it('goes up for more as it is dragged, full travel about 100 px', () => {
    expect(WHEEL_TRAVEL_PX).toBe(100);
    expect(wheelAfterDrag(0, -40)).toBe(0.4);
    expect(wheelAfterDrag(0.5, 20)).toBe(0.3);
    // Held at its ends.
    expect(wheelAfterDrag(0.5, -200)).toBe(1);
    expect(wheelAfterDrag(0.5, 200)).toBe(0);
  });

  it('scrolls down for more, 1 % for each 10 px, as every sandbox wheel', () => {
    expect(wheelAfterScroll(100, 0)).toBe(0.1);
    expect(wheelAfterScroll(-30, 0.5)).toBe(0.47);
    expect(wheelAfterScroll(-30, 0)).toBe(0);
    // A mouse that counts in lines: a line is 16 px.
    expect(wheelAfterScroll(3, 0, 1)).toBe(0.048);
  });

  it('scrolls down for less with the Wheel setting on Reverse', () => {
    expect(wheelAfterScroll(100, 0.5, 0, 'reverse')).toBe(0.4);
    expect(wheelAfterScroll(-100, 0.5, 0, 'reverse')).toBe(0.6);
  });

  it('answers the arrows, Page Up and Down, Home and End', () => {
    expect(wheelAfterKey('ArrowUp', 0.4)).toBe(0.41);
    expect(wheelAfterKey('ArrowRight', 0.4)).toBe(0.41);
    expect(wheelAfterKey('ArrowDown', 0.4)).toBe(0.39);
    expect(wheelAfterKey('ArrowLeft', 0)).toBe(0);
    expect(wheelAfterKey('PageUp', 0.95)).toBe(1);
    expect(wheelAfterKey('PageDown', 0.4)).toBe(0.3);
    expect(wheelAfterKey('Home', 0.4)).toBe(0);
    expect(wheelAfterKey('End', 0.4)).toBe(1);
    // A drag's amount between whole percents steps from the nearest.
    expect(wheelAfterKey('ArrowUp', 0.437)).toBe(0.45);
    expect(wheelAfterKey('a', 0.4)).toBeNull();
  });

  it('says its amount in percent', () => {
    expect(formatWheel(0.4)).toBe('40 %');
    expect(formatWheel(1)).toBe('100 %');
  });

  it('adds 50 cents of vibrato and no tremolo at full on every factory voice', () => {
    const presets = chapterById('sandbox')?.presets ?? [];
    expect(presets).toHaveLength(32);
    for (const preset of presets) {
      expect(preset.patch.dxLfo).toMatchObject({ wheelVibrato: 50, wheelTremolo: 0 });
    }
  });
});
