import { DEFAULT_SETTINGS, type Settings } from './settings';

// The Settings dialog's tree (the settings philosophy; Jeremy, 2026-10-29),
// shaped like REAPER's Preferences: groups, each with its sections, one
// section's fields shown at a time. General covers the whole app; Synth
// and Learn are the two pages. No DOM.

/** A section of the tree: its name, and the settings it shows, in order. */
export interface TreeSection {
  id: string;
  name: string;
  /** The settings it holds; a readout (MIDI's Last velocity) is the dialog's own. */
  fields: readonly (keyof Settings)[];
}

export interface TreeGroup {
  id: 'general' | 'synth' | 'learn';
  name: string;
  sections: readonly TreeSection[];
}

/**
 * Every group and section. Learn has nothing of its own yet (its theme,
 * motion and tips are app-wide, under General), so it is not shown until
 * it has.
 */
export const SETTINGS_TREE: readonly TreeGroup[] = [
  {
    id: 'general',
    name: 'General',
    sections: [{ id: 'appearance', name: 'Appearance', fields: ['theme', 'motion', 'tips'] }],
  },
  {
    id: 'synth',
    name: 'Synth',
    sections: [
      { id: 'display', name: 'Display', fields: ['screenGlitch', 'zxHint', 'noteNames', 'computerKeys'] },
      { id: 'keyboard', name: 'Keyboard', fields: ['keyVelocity', 'wheel'] },
      { id: 'midi', name: 'MIDI', fields: ['midi', 'midiInput', 'midiChannel', 'bendRange', 'velocityCurve'] },
    ],
  },
  { id: 'learn', name: 'Learn', sections: [] },
];

/** The groups and sections shown: none with nothing to choose. */
export function shownTree(tree: readonly TreeGroup[] = SETTINGS_TREE): TreeGroup[] {
  return tree
    .map(group => ({ ...group, sections: group.sections.filter(section => section.fields.length > 0) }))
    .filter(group => group.sections.length > 0);
}

/** Whether a staged `draft` differs from what is saved: Apply is enabled only then. */
export function draftDiffers(draft: Settings, saved: Settings): boolean {
  return (Object.keys(saved) as (keyof Settings)[]).some(key => draft[key] !== saved[key]);
}

/** `draft` with `key` back at its default (a double click on its label; staged like any change). */
export function resetField(draft: Settings, key: keyof Settings): Settings {
  return { ...draft, [key]: DEFAULT_SETTINGS[key] };
}

/** "Synth › MIDI", the pane's heading. */
export const paneHeading = (group: TreeGroup, section: TreeSection) => `${group.name} › ${section.name}`;
