import { BASE_PATCH } from './basePatch';
import { define, formula, wikipedia } from './terms';
import { sectionLink, titleOf } from './outline';
import type { Chapter } from './types';

export const modulationIndex: Chapter = {
  id: 'index',
  title: titleOf('index'),
  body: [
    `The last section ended with the modulator fast enough to make a tone
     colour. Here it runs at the carrier's own frequency, 220 Hz, and
     stays there. (From here on it also pushes the carrier in a slightly
     different way, the way the DX7 does. The sounds are the same family;
     ${sectionLink('fm-vs-pm')} says what changed.)`,
    `With a modulator this fast, the deviation on its own says little. A
     swing of 220 Hz is a wild wobble on a 5 Hz modulator, and only a
     touch of colour on a 220 Hz one. What decides the sound is the
     deviation divided by the modulator's frequency. That number is the
     ${define('index')}, and it is the one slider here, Index. At 1 the
     carrier swings 220 Hz each way, 220 times a second.`,
    `Press Play and drag Index down to 0. That is the bare sine wave of
     ${sectionLink('sine')}, one stem in Fig. 2. Now bring it up slowly. New
     stems grow to the right of the carrier, first one, then another, and
     the sound gets steadily brighter, like a brass player blowing harder.
     More index, more sidebands.`,
    `With the modulator at the carrier's frequency, those sidebands stand
     one carrier frequency apart: at two, three, four times the carrier's
     frequency. Partials at whole-number multiples of a note's frequency
     are its ${define('harmonic', 'harmonics')}. That is why this sounds
     like one pitched instrument and not a chord.`,
    `Keep raising Index and watch the stems reach further out. The span of
     frequencies a sound's partials cover is its ${define('bandwidth')},
     and more index makes it wider. In principle there is no last
     sideband, but the far ones are too small to matter.`,
    `So how wide is it, for a given index? A rule of thumb from radio,
     ${define('carson')}, says nearly all of the sound lies within the
     index plus one sidebands each side of the carrier. The bracket across
     the top of Fig. 2 marks that span. Move Index and watch it follow the
     sidebands out and back.`,
  ],
  maths: [
    {
      title: 'What the index is',
      body: [
        `In ${sectionLink('vibrato')} the modulator moved the carrier's
         frequency by up to Δ<var>f</var>. The index is that deviation over
         the modulator's frequency:`,
        formula('index'),
        `So at an index of 2 with a 220 Hz modulator, the pitch is being
         swung 440 Hz each way, 220 times a second. Nobody hears that as
         a pitch moving.`,
        `With the modulator at the carrier's frequency <var>f</var>,
         sideband <var>n</var> stands at (1 + <var>n</var>) <var>f</var>:
         the harmonics,`,
        formula('harmonic'),
      ],
    },
    {
      title: "Carson's rule",
      body: [
        `Sideband <var>n</var> stands at
         <var>f</var><sub>c</sub> ± <var>n</var> <var>f</var><sub>m</sub>.
         John Carson worked out in 1922, for radio, how many of them a
         receiver has to let through, the
         ${wikipedia('Carson_bandwidth_rule', 'Carson bandwidth rule')}:`,
        formula('carson'),
        `<var>B</var> is the bandwidth, centred on the carrier, that holds
         about 98% of the power: <var>I</var> + 1 sidebands each side. The
         bracket in Fig. 2 runs from
         <var>f</var><sub>c</sub> − (<var>I</var> + 1) <var>f</var><sub>m</sub>
         to
         <var>f</var><sub>c</sub> + (<var>I</var> + 1) <var>f</var><sub>m</sub>,
         stopping at zero on the left; ${sectionLink('ratio')} says what becomes of the
         sidebands beyond it.`,
      ],
    },
  ],
  controls: ['volume', 'index'],
  presets: [],
  showsPair: true,
  hasMotion: false,
  patch: {
    ...BASE_PATCH,
    index: 1,
    showBandwidth: true,
  },
  figures: {
    waveform:
      'Waveform. Two cycles of the output, with the modulator behind it as the thinner line.',
    spectrum:
      "Spectrum. The bracket is Carson's rule: the index plus one sidebands each side of the carrier.",
  },
};
