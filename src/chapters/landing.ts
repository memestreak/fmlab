import { BASE_PATCH } from './basePatch';
import { LANDING } from './outline';
import type { Chapter } from './types';

export { LANDING };

/**
 * Where the site opens: one line of what this is and one button. It is
 * written as a chapter so that everything that follows the store's
 * chapter (the figures, the engine, the sliders shown) needs no special
 * case for it. Pressing its button plays one long note, the index
 * swelling and sinking, while the two figures move with the sound.
 */
export const landing: Chapter = {
  id: LANDING,
  title: 'Hearing FM',
  body: [
    `An interactive guide to FM (frequency modulation) synthesis: how two
     sine waves, one bending
     the other, make sounds as rich as a brass section or a bell. Press
     Play.`,
  ],
  maths: [],
  controls: ['volume'],
  presets: [],
  patch: {
    ...BASE_PATCH,
    noteMode: true,
    // A slow swell on 1:1: the plain sine wave grows harmonics one after
    // another and gives some back. Its brightness follows the envelope, so
    // it stops moving once the decay has settled (attack + decay, 2.2 s);
    // it is let go right then, and gone 0.2 s later. The release falls
    // smoothly towards silence and nothing cuts it off, so it ends with
    // no click.
    carrierHz: 220,
    ratio: 1,
    index: 6,
    attack: 1.6,
    decay: 0.6,
    sustain: 0.6,
    hold: 2.2,
    release: 0.2,
  },
  figures: {
    waveform:
      'Waveform. The sound itself, two cycles at a time, with the modulator behind it as the thinner line.',
    spectrum:
      'Spectrum. The sine waves the sound is made of. One becomes many as the modulator pushes harder.',
  },
};
