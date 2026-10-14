import { BASE_PATCH } from './basePatch';
import { define, formula } from './terms';
import { sectionLink, titleOf } from './outline';
import type { Chapter } from './types';

export const modulationIndex: Chapter = {
  id: 'index',
  title: titleOf('index'),
  body: [
    `The last section ended with the modulator fast enough to make a tone
     colour. Here it runs at the carrier's own frequency, 220 Hz, and
     stays there, and it pushes the carrier a slightly different way.
     ${define('phase')} ${define('radian')} ${define('pm')} The DX7 does
     the same, and so does the rest of this guide; ${sectionLink('fm-vs-pm')} says why.`,
    `There is one thing to change here. ${define('index')} Press Play and drag Index down to 0. That is the
     bare sine wave of ${sectionLink('sine')}, one stem in Fig. 2. Now bring it up
     slowly. New stems grow to the right of the carrier, first one, then
     another, and the sound gets steadily brighter, like a brass player
     blowing harder. More index, more sidebands.`,
    `${define('harmonic')} With the modulator at the carrier's frequency,
     the sidebands, one modulator frequency apart, stand at two, three,
     four times the carrier's frequency: they are its harmonics. That is
     why this sounds like one pitched instrument and not a chord.`,
    `Sidebands grow below the carrier as well as above it. Here there is
     no room for them: one step down from 220 Hz is zero, and anything
     that goes further bounces back up and lands on the stems already
     there. ${sectionLink('ratio')} is about that bounce. For now, notice only that some
     stems hang below the axis, in red with a hollow marker. Those
     partials are upside down. On its own that cannot be heard, but it
     changes what happens when two of them land in the same place.`,
    `How many sidebands are there? In principle there is no last one, but
     they shrink quickly. ${define('bandwidth')} ${define('carson')} The
     bracket across the top of Fig. 2 marks that span, whatever the
     index.`,
  ],
  maths: [
    {
      title: 'What the index is',
      body: [
        `From here on the modulator is added to the carrier's phase:`,
        formula('pm'),
        `<var>I</var> is the index: the furthest the phase is pushed, in
         radians, where`,
        formula('radian'),
        `It is the same number as in ${sectionLink('vibrato')}, where the modulator moved
         the frequency by up to Δ<var>f</var>:`,
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
         receiver has to let through:`,
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
      "Spectrum. The bracket is Carson's rule: the index plus one sidebands each side of the carrier. A stem below the axis, with a hollow marker, is upside down.",
  },
};
