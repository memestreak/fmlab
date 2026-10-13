import type { Chapter } from './types';

export const bessel: Chapter = {
  number: 4,
  title: 'Sidebands and Bessel functions',
  navLabel: '4',
  body: [
    `Chapter 3 showed that more index means more sidebands. It did not say
     how tall each one is. They do not simply grow: drag the line in
     Fig. 2 from left to right and watch Fig. 1. Each stem rises, falls
     away to nothing, and comes back upside down, each at its own pace.`,
    `To see that plainly this chapter moves the two waves apart. The
     carrier is up at 880 Hz and the modulator down at 55 Hz, so the
     sidebands stand 55 Hz apart on both sides of the carrier with plenty
     of room, and none of them bounces off zero.`,
    `Fig. 2 is the map. Each curve belongs to one pair of sidebands and
     shows that pair's height at every index. J<sub>0</sub> is the carrier
     itself; J<sub>1</sub> is the first sideband each side of it;
     J<sub>2</sub> the second; and so on. The upright line is the index
     you are hearing. Where it crosses a curve is that sideband's height
     in Fig. 1, and the dots mark the crossings. Drag the line, or click
     Fig. 2 and use the arrow keys.`,
    `Point at a curve, or at one of the J buttons under the figure, and
     its pair of stems is picked out in Fig. 1. Point at a stem and its
     curve is picked out. Press a J button to keep it picked out.`,
    `Now press <strong>Make the carrier vanish</strong>. At an index of
     2.405 the J<sub>0</sub> curve crosses zero, and the carrier, the one
     wave you started with, is gone from the sound. Everything you hear is
     sidebands. That is the heart of FM: the index does not add partials
     to the carrier, it moves the sound's energy around among them.`,
    `Where a curve dips below zero its dot turns red and hollow, and so
     does its stem: that sideband is upside down. One more wrinkle: on the
     lower side, the odd-numbered sidebands (first, third, fifth) are
     flipped once more, so the two stems of an odd pair point opposite
     ways.`,
  ],
  maths: [
    {
      title: 'Where the curves come from',
      body: [
        `The phase-modulated signal can be written out exactly as a sum of
         plain sine waves, one for each whole number <var>n</var>:`,
        `<p class="formula">sin(2π <var>f</var><sub>c</sub> <var>t</var> + <var>I</var> sin 2π <var>f</var><sub>m</sub> <var>t</var>) = Σ <var>J</var><sub><var>n</var></sub>(<var>I</var>) sin 2π (<var>f</var><sub>c</sub> + <var>n</var> <var>f</var><sub>m</sub>) <var>t</var></p>`,
        `The sum runs over every <var>n</var>, negative ones too.
         <var>J</var><sub><var>n</var></sub> is the Bessel function of the
         first kind of order <var>n</var>: the curves in Fig. 2. Sideband
         <var>n</var> stands at
         <var>f</var><sub>c</sub> + <var>n</var> <var>f</var><sub>m</sub>
         and is <var>J</var><sub><var>n</var></sub>(<var>I</var>) tall.`,
        `For the lower sidebands,`,
        `<p class="formula"><var>J</var><sub>−<var>n</var></sub>(<var>I</var>) = (−1)<sup><var>n</var></sup> <var>J</var><sub><var>n</var></sub>(<var>I</var>)</p>`,
        `which is the extra flip of the odd ones.`,
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
         zero until <var>I</var> is about <var>n</var>, which is Carson's
         rule from chapter 3 seen from the other side.`,
      ],
    },
  ],
  controls: ['volume'],
  hasMotion: false,
  patch: {
    mode: 'pm',
    // Far enough apart that no sideband worth drawing reaches zero.
    carrierHz: 880,
    ratio: 1 / 16,
    index: 1,
    modHz: 5,
    deviationHz: 20,
    showModulator: true,
    showBandwidth: false,
  },
  figures: {
    spectrum:
      'Spectrum. The carrier at 880 Hz and its sidebands, 55 Hz apart. A stem below the axis, with a hollow marker, is upside down.',
    bessel:
      'Bessel functions. Each curve is the height of one pair of sidebands at every index; the upright line is the index now. Drag it, or use the arrow keys.',
  },
};
