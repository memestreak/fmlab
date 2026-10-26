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
    // Not the volume, the reverb or the octave: they are the listener's.
    expect(soundLink({ ...state, volume: 0.123 }, location)).toBe(link);
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
