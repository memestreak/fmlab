import { BASE_PATCH } from './basePatch';
import { DX7_PRESETS, STACKS } from './dx7Presets';
import { titleOf } from './outline';
import type { Chapter } from './types';

/**
 * The sandbox: an instrument page, not a section. It has no lesson and
 * no maths, only a line beside its title; its controls, figures and
 * keyboard are laid out by ui/instrument.ts. Two operators are drawn as a
 * signal flow, each control with a one-line hint (`HINTS`).
 */
const twoOperators: Chapter = {
  id: 'sandbox',
  title: titleOf('sandbox'),
  body: [],
  maths: [],
  instrument: true,
  lede: 'Two sine waves, one bending the other.',
  controls: ['volume', 'carrier', 'ratio', 'index'],
  presets: [
    { label: 'Flute', hint: 'ratio 1, index 0.8', patch: { ratio: 1, index: 0.8 } },
    { label: 'Brass', hint: 'ratio 1, index 4', patch: { ratio: 1, index: 4 } },
    { label: 'Clarinet', hint: 'ratio 2, index 2.5', patch: { ratio: 2, index: 2.5 } },
    { label: 'Bell', hint: 'ratio 1.41, index 5', patch: { ratio: 1.414, index: 5 } },
    { label: 'Gong', hint: 'ratio 1.73, index 9', patch: { ratio: 1.732, index: 9 } },
    { label: 'Bass', hint: 'ratio 0.5, index 2', patch: { ratio: 0.5, index: 2 } },
  ],
  hasPiano: true,
  sharesSound: true,
  patch: {
    ...BASE_PATCH,
    index: 2,
    // What Six operators starts from: chapter 8's Stacks.
    ...STACKS,
  },
  figures: {
    waveform:
      'Waveform. Two cycles of the output, with the modulator behind it as the thinner line.',
    spectrum:
      'Spectrum. A stem below the axis, with a hollow marker, is upside down.',
  },
};

/**
 * The one-line hint under each of Two operators' controls, by the id of
 * its slider. Every term in them is defined in an earlier section.
 */
export const HINTS: Partial<Record<'ratio' | 'index' | 'carrier', string>> = {
  ratio:
    'Modulator over carrier. Whole numbers sound pitched; between them, bells and clangs.',
  index: 'How hard the modulator pushes. More index, more sidebands: brighter.',
  carrier: 'The pitch. A key on the keyboard sets it too.',
};

/**
 * The sandbox with six operators: chapter 8's lab (the algorithm list,
 * the operator table, feedback and its presets), with the sandbox's
 * keyboard, and its sound in the link. It plays notes, as chapter 8 does.
 */
const sixOperators: Chapter = {
  ...twoOperators,
  lede: "Six operators, wired by any of the DX7's 32 algorithms.",
  // No Carrier slider: the keyboard sets the pitch of every note.
  controls: ['volume', 'feedback'],
  presets: DX7_PRESETS,
  patch: { ...twoOperators.patch, mode: 'ops', noteMode: true },
  figures: {
    algorithm: 'The algorithm: carriers along the bottom, heard; modulators above.',
    spectrum: 'Spectrum, worked out numerically: heights only.',
  },
};

export const sandbox: Chapter = { ...twoOperators, sixOperators };
