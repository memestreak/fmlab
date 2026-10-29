import { DEFAULT_SETTINGS, SETTING_SECTIONS } from '../../model/settings';
import { draftDiffers, paneHeading, resetField, SETTINGS_TREE, shownTree } from '../../model/settingsTree';

// The Settings dialog's tree (the settings philosophy; Jeremy, 2026-10-29).
describe('the Settings tree', () => {
  it('is General, then the synth\'s sections; Learn, with none, is not shown', () => {
    const shown = shownTree();
    expect(shown.map(group => group.name)).toEqual(['General', 'Synth']);
    expect(shown.map(group => group.sections.map(section => section.name))).toEqual([
      ['Appearance'],
      ['Display', 'Keyboard', 'MIDI'],
    ]);
    expect(SETTINGS_TREE.find(group => group.id === 'learn')?.sections).toEqual([]);
  });

  it('shows each section\'s settings as its storage key holds them', () => {
    for (const group of SETTINGS_TREE) {
      for (const section of group.sections) {
        const key = `fmlab.${group.id}.${section.id}` as keyof typeof SETTING_SECTIONS;
        expect(section.fields, key).toEqual(SETTING_SECTIONS[key]);
      }
    }
  });

  it('heads the pane "Group › Section"', () => {
    const [, synth] = shownTree();
    expect(paneHeading(synth, synth.sections[2])).toBe('Synth › MIDI');
  });

  it('enables Apply only while something staged differs from what is saved', () => {
    expect(draftDiffers(DEFAULT_SETTINGS, DEFAULT_SETTINGS)).toBe(false);
    expect(draftDiffers({ ...DEFAULT_SETTINGS }, DEFAULT_SETTINGS)).toBe(false);
    expect(draftDiffers({ ...DEFAULT_SETTINGS, wheel: 'reverse' }, DEFAULT_SETTINGS)).toBe(true);
  });

  it('puts one field back to its default, leaving the rest staged', () => {
    const draft = { ...DEFAULT_SETTINGS, wheel: 'reverse', bendRange: 12 } as const;
    expect(resetField(draft, 'bendRange')).toEqual({ ...DEFAULT_SETTINGS, wheel: 'reverse' });
  });
});
