import { BASE_PATCH } from './basePatch';
import { use } from './terms';
import { DX7_PRESETS, STACKS } from './dx7Presets';
import { sectionLink, titleOf } from './outline';
import type { Chapter } from './types';

const twoOperators: Chapter = {
  id: 'sandbox',
  title: titleOf('sandbox'),
  body: [
    `Every control for two sine waves, with no lesson attached. The
     modulator bends the carrier's ${use('phase')}; what you hear is what
     the two figures draw.`,
    `Ratio sets the ${use('ratio')}, the modulator's frequency as a
     multiple of the carrier's. Whole numbers give
     ${use('harmonic', 'harmonic')}, pitched sounds; anything between
     gives ${use('inharmonic')} clangs and bells. Index sets the
     ${use('index')}, how hard the modulator pushes: more index, more
     ${use('sideband', 'sidebands')}, a brighter sound.`,
    `Play it from the keyboard under the sliders, or from your
     computer's: the row from A to K is the white notes from C, the row
     above it the black notes, and Z and X move down and up an octave.
     Hold a key and the sound plays at that pitch; let go and it stops.`,
    `The buttons are places to start: a flute, brass, a clarinet, a bell,
     a gong and a bass, each a single ratio and index. Change them and
     listen to what each slider does.`,
    `The page's address keeps the sound as you change it. Copy link, or
     the address itself, and whoever opens it hears the same sound.`,
    `Switch to Six and this becomes the lab of ${sectionLink('algorithms')}: six ${use('operator', 'operators')} wired by any of the DX7's 32 ${use('algorithm', 'algorithms')}, with the keyboard and the link kept. Each key then strikes a note that dies away by itself.`,
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
         a ${use('bessel')}. One that falls below zero folds back to the
         positive frequency upside down, which Fig. 2 draws below the
         axis.`,
      ],
    },
  ],
  controls: ['volume', 'carrier', 'ratio', 'index'],
  presets: [
    { label: 'Flute', hint: 'ratio 1, index 0.8', patch: { ratio: 1, index: 0.8 } },
    { label: 'Brass', hint: 'ratio 1, index 4', patch: { ratio: 1, index: 4 } },
    { label: 'Clarinet', hint: 'ratio 2, index 2.5', patch: { ratio: 2, index: 2.5 } },
    { label: 'Bell', hint: 'ratio 1.41, index 5', patch: { ratio: 1.414, index: 5 } },
    { label: 'Gong', hint: 'ratio 1.73, index 9', patch: { ratio: 1.732, index: 9 } },
    { label: 'Bass', hint: 'ratio 0.5, index 2', patch: { ratio: 0.5, index: 2 } },
  ],
  showsPair: true,
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
 * The sandbox with six operators: chapter 8's lab (the algorithm list,
 * the operator table, feedback and its presets), with the sandbox's
 * keyboard, and its sound in the link. It plays notes, as chapter 8 does.
 */
const sixOperators: Chapter = {
  ...twoOperators,
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
