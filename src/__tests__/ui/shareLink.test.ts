import { chapterById } from '../../chapters';
import { paramsFromHash, soundFromParams, soundParams } from '../../chapters/route';
import { DEFAULTS, type LabState } from '../../model/lab';
import { nameOnGlass, presetOf, soundLink } from '../../ui/chapterView';

// Jeremy, 2026-10-25: a sound can be shared as a link, which opens with it.
const sandbox = chapterById('sandbox')!;
const presets = sandbox.presets;
const stateOf = (patch: Partial<LabState>): LabState => ({ ...DEFAULTS, ...sandbox.patch, ...patch, chapter: 'sandbox' }) as LabState;
/** A sound through its link and back, as the page opens it. */
const reopened = (state: LabState): LabState =>
  stateOf(soundFromParams(paramsFromHash(new URL(soundLink(state, location)).hash)));
const location = { origin: 'https://fmlab.pages.dev', pathname: '/', search: '' };

describe('a shared sound', () => {
  it('is this page\'s address with the sound, the voice only', () => {
    const state = stateOf(presets[10].patch);
    const link = soundLink(state, location);
    expect(link).toBe(`https://fmlab.pages.dev/#/?${soundParams(state)}`);
    // Not the volume or the octave: they are the listener's.
    expect(soundLink({ ...state, volume: 0.123 }, location)).toBe(link);
  });

  it('carries the reverb, part of the sound (Jeremy, 2026-10-29)', () => {
    const wet = stateOf({
      ...presets[10].patch,
      dxReverb: { on: true, decay: 2.4, mix: 30, tone: 60, preDelay: 20 },
    });
    expect(soundParams(wet)).toContain('r=1_2.4_30_60_20');
    expect(reopened(wet).dxReverb).toEqual(wet.dxReverb);
    // Held in range and to its steps.
    const read = (r: string) => soundFromParams(new URLSearchParams({ r })).dxReverb;
    expect(read('1_99_25.4_300_900')).toEqual({ on: true, decay: 20, mix: 25, tone: 100, preDelay: 500 });
    expect(read('1_0.04_-5_0_-1')).toEqual({ on: true, decay: 0.2, mix: 0, tone: 0, preDelay: 0 });
    // Not a reverb: left out.
    expect(read('2_1.5_25_70_0')).toBeUndefined();
    expect(read('1_1.5_25_70')).toBeUndefined();
    expect(read('1_x_25_70_0')).toBeUndefined();
  });

  it('opens with the reverb off when its link has none', () => {
    const wet = stateOf({ ...presets[10].patch, dxReverb: { ...presets[10].patch.dxReverb!, on: true } });
    const params = new URLSearchParams(soundParams(wet));
    params.delete('r');
    const opened = { ...sandbox.patch, ...soundFromParams(params) };
    expect(opened.dxReverb?.on).toBe(false);
  });

  it('starts every preset dry, and marks a reverb edit EDITED', () => {
    presets.forEach(preset => expect(preset.patch.dxReverb?.on, preset.label).toBe(false));
    const state = stateOf(presets[10].patch);
    expect(nameOnGlass(presets, state, null).text).toBe(presets[10].label);
    const wet = { ...state, dxReverb: { ...state.dxReverb, on: true } };
    expect(nameOnGlass(presets, wet, null)).toEqual({ text: 'Edited', edited: true, preset: -1 });
    const longer = { ...state, dxReverb: { ...state.dxReverb, decay: 4 } };
    expect(presetOf(presets, longer)).toBe(-1);
  });

  it('brings back every bank A and B preset exactly, and its name', () => {
    expect(presets).toHaveLength(64);
    presets.forEach((preset, i) => {
      const back = reopened(stateOf(preset.patch));
      expect(presetOf(presets, back), preset.label).toBe(i);
      expect(nameOnGlass(presets, back, null).text).toBe(preset.label);
    });
  });

  it('opened from a link and not a preset, is SHARED until it is changed', () => {
    const tweaked = stateOf({
      ...presets[10].patch,
      dxFeedback: 1.25,
    });
    const back = reopened(tweaked);
    const opened = soundParams(back);
    expect(nameOnGlass(presets, back, opened)).toEqual({ text: 'Shared', edited: false, preset: -1 });
    // Changed after: EDITED, dimmer.
    const changed = { ...back, dxFeedback: 2.5 };
    expect(nameOnGlass(presets, changed, opened)).toEqual({ text: 'Edited', edited: true, preset: -1 });
    // With no link opened: EDITED.
    expect(nameOnGlass(presets, back, null).text).toBe('Edited');
  });
});
