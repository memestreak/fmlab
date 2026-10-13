import type { Chapter } from './types';

export const sandbox: Chapter = {
  number: 7,
  title: 'Sandbox',
  navLabel: 'Sandbox',
  body: [
    `Every control for two sine waves, with no lesson attached. The
     modulator bends the carrier's phase; what you hear is what the two
     figures draw.`,
    `<strong>Ratio</strong> is the modulator's frequency as a multiple of
     the carrier's. Whole numbers give harmonic, pitched sounds; anything
     between gives clangs and bells. <strong>Index</strong> is how hard
     the modulator pushes: more index, more sidebands, a brighter sound.`,
    `The chapters between the second and this one are still to be
     written. They will explain what the sliders here are doing.`,
  ],
  maths: [
    {
      title: 'What is being played',
      body: [
        `<p class="formula"><var>x</var>(<var>t</var>) = sin(2π <var>f</var><sub>c</sub> <var>t</var> + <var>I</var> sin(2π <var>f</var><sub>m</sub> <var>t</var>))</p>`,
        `<var>f</var><sub>c</sub> is Carrier, <var>f</var><sub>m</sub> is
         Carrier times Ratio, and <var>I</var> is Index, in radians.
         Sideband <var>n</var> stands at
         <var>f</var><sub>c</sub> + <var>n</var> <var>f</var><sub>m</sub>
         with amplitude <var>J</var><sub><var>n</var></sub>(<var>I</var>),
         a Bessel function. One that falls below zero folds back to the
         positive frequency upside down, which Fig. 2 draws below the
         axis.`,
      ],
    },
  ],
  controls: ['volume', 'carrier', 'ratio', 'index'],
  patch: {
    mode: 'pm',
    carrierHz: 220,
    ratio: 1,
    index: 2,
    modHz: 5,
    deviationHz: 20,
    showModulator: true,
  },
  captions: {
    waveform:
      'Waveform. Two cycles of the output, with the modulator behind it as the thinner line.',
    spectrum:
      'Spectrum. A stem below the axis, with a hollow marker, has negative phase.',
  },
};
