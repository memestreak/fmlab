import { BASE_PATCH } from './basePatch';
import { define, formula, wikipedia } from './terms';
import { sectionLink, titleOf } from './outline';
import type { Chapter } from './types';

export const bessel: Chapter = {
  id: 'sidebands',
  title: titleOf('sidebands'),
  body: [
    `${sectionLink('index')} showed that more index means more sidebands. It did not say
     how tall each one is. They do not simply grow: drag the line in
     Fig. 2 from left to right and watch Fig. 1. Each stem rises, falls
     away to nothing, and comes back upside down, each at its own pace.`,
    `To see that plainly this section moves the two waves apart. The
     carrier is up at 880 Hz and the modulator down at 55 Hz, a sixteenth
     of it. That spreads the sidebands out, 55 Hz apart on both sides of
     the carrier, so they are easy to count, and none of them comes near
     zero.`,
    `Fig. 2 is the map. Each curve gives the height of one pair of
     sidebands at every index: J<sub>1</sub> the first pair, either side
     of the carrier, J<sub>2</sub> the second, and so on, with
     J<sub>0</sub> for the carrier itself. These curves are
     ${define('bessel', 'Bessel functions')}, named after the astronomer
     who studied them in 1824, long before anyone made a sound with them. The upright line is the
     index you are hearing. Where it crosses a curve is that sideband's
     height in Fig. 1, and the dots mark the crossings. Drag the line, or
     click Fig. 2 and use the arrow keys.`,
    `Point at a curve, or at one of the J buttons under the figure, and
     its pair of stems is picked out in Fig. 1. Point at a stem and its
     curve is picked out. Press a J button to keep it picked out.`,
    `Now press <strong>Make the carrier vanish</strong>. At an index of
     2.405 the J<sub>0</sub> curve crosses zero, and the carrier, the one
     wave you started with, is gone from the sound. Everything you hear is
     sidebands. That is the heart of FM: the index does not add partials
     to the carrier, it moves the sound's energy around among them.`,
    `Where a curve dips below zero its dot turns red and hollow, and so
     does its stem in Fig. 1, hanging below the axis. Red means upside
     down: that sideband's wave is flipped, rising where it would have
     fallen. On its own that sounds no different. It matters when two
     partials land in the same place, where they cancel instead of adding;
     ${sectionLink('ratio')} shows where that happens.`,
  ],
  maths: [
    {
      title: 'Where the curves come from',
      body: [
        `The signal can be written out exactly as a sum of
         plain sine waves, one for each whole number <var>n</var>:`,
        formula('bessel'),
        `The sum runs over every <var>n</var>, negative ones too.
         <var>J</var><sub><var>n</var></sub> is the
         ${wikipedia('Bessel_function', 'Bessel function')} of the first
         kind of order <var>n</var>: the curves in Fig. 2. Sideband
         <var>n</var> stands at
         <var>f</var><sub>c</sub> + <var>n</var> <var>f</var><sub>m</sub>
         and is <var>J</var><sub><var>n</var></sub>(<var>I</var>) tall.`,
        `One more wrinkle: on the lower side, the odd-numbered sidebands
         (first, third, fifth) are flipped once more, so the two stems of an
         odd pair point opposite ways. That is because`,
        `<p class="formula"><var>J</var><sub>−<var>n</var></sub>(<var>I</var>) = (−1)<sup><var>n</var></sup> <var>J</var><sub><var>n</var></sub>(<var>I</var>)</p>`,
        `which changes the sign only when <var>n</var> is odd.`,
      ],
    },
    {
      title: 'Zeros, and where the power goes',
      body: [
        `<var>J</var><sub>0</sub> first reaches zero at
         <var>I</var> ≈ 2.405, and again near 5.520 and 8.654. At each the
         carrier vanishes. Every other curve has zeros of its own:
         <var>J</var><sub>1</sub> first at about 3.832.`,
        `However the heights change, the total power does not:`,
        `<p class="formula"><var>J</var><sub>0</sub>(<var>I</var>)<sup>2</sup> + 2 (<var>J</var><sub>1</sub>(<var>I</var>)<sup>2</sup> + <var>J</var><sub>2</sub>(<var>I</var>)<sup>2</sup> + …) = 1</p>`,
        `Turning up the index makes the sound brighter, not louder. And
         <var>J</var><sub><var>n</var></sub>(<var>I</var>) stays close to
         zero until <var>I</var> is about <var>n</var>, which is Carson's rule from ${sectionLink('index')} seen from the other side.`,
      ],
    },
  ],
  controls: ['volume'],
  presets: [],
  showsPair: true,
  patch: {
    ...BASE_PATCH,
    // Far enough apart that no sideband worth drawing reaches zero.
    carrierHz: 880,
    ratio: 1 / 16,
    index: 1,
  },
  figures: {
    spectrum:
      'Spectrum. The carrier at 880 Hz and its sidebands, 55 Hz apart. A stem below the axis, with a hollow marker, is upside down.',
    bessel:
      'Bessel functions. Each curve is the height of one pair of sidebands at every index; the upright line is the index now. Drag it, or use the arrow keys.',
  },
};
