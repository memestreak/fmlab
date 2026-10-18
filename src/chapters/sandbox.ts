import { BASE_PATCH } from './basePatch';
import { DX7_STACKS, DX7_VOICES } from './dx7Voices';
import { titleOf } from './outline';
import type { Chapter } from './types';

/**
 * The sandbox: an instrument page, not a section. It has no lesson and
 * no maths, only a line beside its title; its controls, figures and
 * keyboard are laid out by ui/instrument.ts. Its operators are a DX7
 * voice (dsp/dx7.ts: levels in dB, a four-part envelope, detune and
 * keyboard scaling), edited in its own table and envelope view
 * (ui/voiceTable.ts, ui/envelopeView.ts), with the keyboard and its sound
 * in the link.
 */
export const sandbox: Chapter = {
  id: 'sandbox',
  title: titleOf('sandbox'),
  body: [],
  maths: [],
  instrument: true,
  lede: "Six operators, wired by any of the DX7's 32 algorithms.",
  // No Carrier slider: the keyboard sets the pitch of every note.
  controls: ['volume', 'dxFeedback'],
  presets: DX7_VOICES,
  hasPiano: true,
  sharesSound: true,
  patch: {
    ...BASE_PATCH,
    ...DX7_STACKS,
    mode: 'ops',
    voiceModel: 'dx7',
    noteMode: true,
  },
  figures: {
    algorithm: 'The algorithm: carriers along the bottom, heard; modulators above.',
    spectrum: 'Spectrum, worked out numerically: heights only.',
  },
};
