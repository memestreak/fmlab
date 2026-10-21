import { BASE_PATCH } from './basePatch';
import { DX7_START, SANDBOX_BANKS, SANDBOX_VOICES } from './dx7Voices';
import { titleOf } from './outline';
import type { Chapter } from './types';

/**
 * The sandbox: an instrument page, not a section, a synthesizer of its
 * own. It has no lesson, no maths and no line beside its title: its
 * title bar is the voice's name (the preset menu) and the factory
 * voices' credit, "© Yamaha" (index.html). Its controls, figures and
 * keyboard are laid out by ui/instrument.ts. Its operators are a DX7
 * voice (dsp/dx7.ts: levels in dB, a four-part envelope, detune and
 * key scaling), edited in its own table and envelope view
 * (ui/voiceTable.ts, ui/envelopeView.ts), with the keyboard and its sound
 * in the link.
 */
export const sandbox: Chapter = {
  id: 'sandbox',
  title: titleOf('sandbox'),
  body: [],
  maths: [],
  instrument: true,
  // No Carrier slider: the keyboard sets the pitch of every note.
  // Its Feedback is a knob beside the chooser under the diagram
  // (ui/instrument.ts).
  controls: ['volume'],
  // Two banks of 32: A the DX7's factory voices, B fmlab's own.
  presets: SANDBOX_VOICES,
  presetMenu: true,
  presetBanks: SANDBOX_BANKS,
  hasPiano: true,
  sharesSound: true,
  patch: {
    ...BASE_PATCH,
    // It opens on E.PIANO 1.
    ...DX7_START,
    mode: 'ops',
    voiceModel: 'dx7',
    noteMode: true,
  },
  figures: {
    algorithm: 'The algorithm: carriers along the bottom, heard; modulators above.',
    spectrum: 'Spectrum, worked out numerically: heights only.',
  },
};
