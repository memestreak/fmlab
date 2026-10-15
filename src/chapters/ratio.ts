import { BASE_PATCH } from './basePatch';
import { define, formula } from './terms';
import { sectionLink, titleOf } from './outline';
import type { Chapter } from './types';

export const ratio: Chapter = {
  id: 'ratio',
  title: titleOf('ratio'),
  body: [
    `Why do some FM sounds have a clear pitch, while others clang like a
     bell? The answer is how fast the modulator runs compared with the
     carrier: the ${define('ratio')} of their frequencies. Where the index
     decides how strong each partial is, the ratio decides which partials
     there can be at all.`,
    `This guide writes a ratio as FM players do, carrier first: 1:2 means
     the carrier at 1 and the modulator at 2, twice as fast. The Ratio
     slider shows the modulator's side alone, 2.00, and beside it the
     modulator's frequency in Hz.`,
    `The sidebands stand one modulator frequency apart, counted out from
     the carrier. The faint upright lines in Fig. 2 mark the whole
     multiples of the carrier, which are the harmonics of a note at the
     carrier's pitch. Press Play, then <strong>1:1</strong>. Every
     sideband lands on a line and every line has one: a full, buzzing,
     brassy tone.`,
    `Press <strong>1:2</strong>. The sidebands now step two lines at a
     time: 1, 3, 5, 7. With only the odd harmonics the sound turns hollow,
     like a clarinet. <strong>1:3</strong> steps three at a time and
     leaves out every third harmonic.`,
    `Now press <strong>1:1.41</strong>. The step is no longer a whole
     number of lines, and the sidebands fall between them. Partials that
     do not line up are not heard as one note with a colour, but as
     several pitches at once, the way a bell or a gong is. Such partials
     are ${define('inharmonic')}. Drag Ratio slowly and listen for the
     sound snapping into focus each time it passes a simple ratio.`,
    `Sidebands come in pairs, one above the carrier and one below, and so
     far the lower ones have kept out of the way. Counting down from the
     carrier in steps of the modulator, though, you soon pass zero. A
     sideband down there would have a ${define('negativeFrequency')}: a
     wave running backwards, which is the same as a wave running forwards
     but upside down. So it folds back, sounding the same distance above
     zero, and is drawn upside down: the red stems below the axis, with a
     hollow marker.`,
    `With a whole-number ratio the folded sidebands land back on the
     harmonics. At 1:1 they land on the very ones the upper sidebands
     already occupy, where the two add together or cancel, which is why
     the stems here are not simply the curves of ${sectionLink('sidebands')}. At 1:1.41 they
     land in fresh places between the others and thicken the clang.`,
  ],
  maths: [
    {
      title: 'Which partials a ratio gives',
      body: [
        `Write <var>r</var> for the ratio:`,
        formula('ratio'),
        `Sideband <var>n</var> stands at`,
        `<p class="formula">| 1 + <var>n</var> <var>r</var> | × <var>f</var><sub>c</sub></p>`,
        `for every whole number <var>n</var>, the bars meaning "fold it
         back if it is negative". With <var>r</var> = 2 that is 1, 3, 5, …
         going up and 1, 3, 5, … folded: the odd harmonics, twice over.
         With <var>r</var> = 3 it is 1, 4, 7, … going up and 2, 5, 8, …
         folded: everything but the multiples of three.`,
        `If <var>r</var> is a fraction of whole numbers the partials are
         all harmonics of some note, though not always of the carrier:
         at <var>r</var> = 1/2 they are harmonics of a note an octave
         below it. If <var>r</var> is not such a fraction, as √2 is not,
         they are harmonics of nothing.`,
      ],
    },
    {
      title: 'Folding, and what happens at 1:1',
      body: [
        `A sine wave at a negative frequency is the same wave inverted:`,
        formula('negativeFrequency'),
        `so a sideband below zero is drawn at the positive frequency with
         its sign changed. At a ratio of 1 the partial at harmonic
         <var>k</var> is two sidebands in the same place, the upper one
         <var>k</var> − 1 and the folded lower one <var>k</var> + 1:`,
        `<p class="formula"><var>J</var><sub><var>k</var>−1</sub>(<var>I</var>) + (−1)<sup><var>k</var></sup> <var>J</var><sub><var>k</var>+1</sub>(<var>I</var>)</p>`,
        `For the carrier itself, <var>k</var> = 1, that is
         <var>J</var><sub>0</sub> − <var>J</var><sub>2</sub>: at an index
         of 2 it comes to −0.13, a small stem pointing down.`,
      ],
    },
  ],
  controls: ['volume', 'ratio', 'index'],
  presets: [
    { label: '1:1', hint: 'every harmonic', patch: { ratio: 1 } },
    { label: '1:2', hint: 'odd harmonics only', patch: { ratio: 2 } },
    { label: '1:3', hint: 'no third harmonics', patch: { ratio: 3 } },
    { label: '1:1.41', hint: 'not harmonic: a bell', patch: { ratio: 1.414 } },
  ],
  showsPair: true,
  hasMotion: false,
  patch: {
    ...BASE_PATCH,
    showHarmonics: true,
  },
  figures: {
    waveform:
      'Waveform. Two cycles of the output, with the modulator behind it as the thinner line.',
    spectrum:
      "Spectrum. The upright lines are the carrier's harmonics. A stem below the axis, with a hollow marker, is a sideband folded back from below zero.",
  },
};
