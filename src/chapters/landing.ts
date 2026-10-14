import { BASE_PATCH } from './basePatch';
import type { Chapter } from './types';

/**
 * The number the landing view goes by in the store. It is not a chapter
 * of the guide: it has no hash, and is not in CHAPTERS or the contents.
 */
export const LANDING = 0;

/**
 * Where the site opens: one line of what this is and one button. It is
 * written as a chapter so that everything that follows the store's
 * chapter (the figures, the engine, the sliders shown) needs no special
 * case for it. Pressing its button plays one long note, the index
 * swelling and sinking, while the two figures move with the sound.
 */
export const landing: Chapter = {
  number: LANDING,
  title: 'fmlab',
  navLabel: 'fmlab',
  body: [
    `An interactive guide to FM (frequency modulation) synthesis: how two
     sine waves, one bending
     the other, make sounds as rich as a brass section or a bell. Press
     Play.`,
  ],
  maths: [],
  controls: ['volume'],
  presets: [],
  hasMotion: false,
  patch: {
    ...BASE_PATCH,
    noteMode: true,
    // A slow swell on 1:1: the plain sine wave grows harmonics one after
    // another, holds, and gives them back.
    carrierHz: 220,
    ratio: 1,
    index: 6,
    attack: 1.6,
    decay: 0.6,
    sustain: 0.6,
    hold: 2.8,
    release: 1.6,
  },
  figures: {
    waveform:
      'Waveform. The sound itself, two cycles at a time, with the modulator behind it as the thinner line.',
    spectrum:
      'Spectrum. The sine waves the sound is made of. One becomes many as the modulator pushes harder.',
  },
};
