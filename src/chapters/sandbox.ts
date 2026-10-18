import { BASE_PATCH } from './basePatch';
import { DX7_PRESETS, STACKS } from './dx7Presets';
import { titleOf } from './outline';
import type { Chapter } from './types';

/**
 * The sandbox: an instrument page, not a section. It has no lesson and
 * no maths, only a line beside its title; its controls, figures and
 * keyboard are laid out by ui/instrument.ts. It is chapter 8's
 * six-operator lab (the algorithm list, the operator table, feedback and
 * its presets) with the keyboard and its sound in the link, playing notes
 * as chapter 8 does.
 */
export const sandbox: Chapter = {
  id: 'sandbox',
  title: titleOf('sandbox'),
  body: [],
  maths: [],
  instrument: true,
  lede: "Six operators, wired by any of the DX7's 32 algorithms.",
  // No Carrier slider: the keyboard sets the pitch of every note.
  controls: ['volume', 'feedback'],
  presets: DX7_PRESETS,
  hasPiano: true,
  sharesSound: true,
  patch: {
    ...BASE_PATCH,
    // It starts from chapter 8's Stacks.
    ...STACKS,
    mode: 'ops',
    noteMode: true,
  },
  figures: {
    algorithm: 'The algorithm: carriers along the bottom, heard; modulators above.',
    spectrum: 'Spectrum, worked out numerically: heights only.',
  },
};
