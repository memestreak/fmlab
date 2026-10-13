import type { Chapter } from './types';

export const modulationIndex: Chapter = {
  number: 3,
  title: 'Modulation index',
  navLabel: '3',
  body: [
    `The last chapter ended with the modulator fast enough to make a tone
     colour. Here it runs at the carrier's own frequency, 220 Hz, and
     stays there. The one thing to change is how hard it pushes: the
     <strong>modulation index</strong>.`,
    `Press Play and drag Index down to 0. That is the bare sine wave of
     chapter 1, one stem in Fig. 2. Now bring it up slowly. New stems grow
     to the right of the carrier, first one, then another, and the sound
     gets steadily brighter, like a brass player blowing harder. More
     index, more sidebands.`,
    `The sidebands stand one modulator frequency apart. With the modulator
     at the carrier's frequency that puts them at twice, three times,
     four times the carrier: the harmonics of a note. That is why this
     sounds like one pitched instrument and not a chord.`,
    `Sidebands grow below the carrier as well as above it. Here there is
     no room for them: one step down from 220 Hz is zero, and anything
     that goes further bounces back up and lands on the stems already
     there. Chapter 5 is about that bounce. For now, notice only that some
     stems hang below the axis, in red with a hollow marker. Those
     partials are upside down. On its own that cannot be heard, but it
     changes what happens when two of them land in the same place.`,
    `How many sidebands are there? In principle there is no last one, but
     they shrink quickly, and a rule of thumb says where to stop counting:
     the index plus one, on each side. The bracket across the top of
     Fig. 2 marks that span. Nearly all of the sound's power is inside it,
     whatever the index.`,
  ],
  maths: [
    {
      title: 'What the index is',
      body: [
        `From here on the modulator is added to the carrier's phase:`,
        `<p class="formula"><var>x</var>(<var>t</var>) = sin(2π <var>f</var><sub>c</sub> <var>t</var> + <var>I</var> sin(2π <var>f</var><sub>m</sub> <var>t</var>))</p>`,
        `<var>I</var> is the index: the furthest the phase is pushed, in
         radians. It is the same number as in chapter 2, where the
         modulator moved the frequency by up to Δ<var>f</var>:`,
        `<p class="formula"><var>I</var> = Δ<var>f</var> / <var>f</var><sub>m</sub></p>`,
        `So at an index of 2 with a 220 Hz modulator, the pitch is being
         swung 440 Hz each way, 220 times a second. Nobody hears that as
         a pitch moving.`,
      ],
    },
    {
      title: "Carson's rule",
      body: [
        `Sideband <var>n</var> stands at
         <var>f</var><sub>c</sub> ± <var>n</var> <var>f</var><sub>m</sub>.
         John Carson worked out in 1922, for radio, how many of them a
         receiver has to let through:`,
        `<p class="formula"><var>B</var> ≈ 2 (Δ<var>f</var> + <var>f</var><sub>m</sub>) = 2 <var>f</var><sub>m</sub> (<var>I</var> + 1)</p>`,
        `<var>B</var> is the width of the band, centred on the carrier,
         that holds about 98% of the power: <var>I</var> + 1 sidebands
         each side. The bracket in Fig. 2 runs from
         <var>f</var><sub>c</sub> − (<var>I</var> + 1) <var>f</var><sub>m</sub>
         to
         <var>f</var><sub>c</sub> + (<var>I</var> + 1) <var>f</var><sub>m</sub>,
         stopping at zero on the left, where the lower sidebands fold
         back.`,
      ],
    },
  ],
  controls: ['volume', 'index'],
  hasMotion: false,
  patch: {
    mode: 'pm',
    carrierHz: 220,
    ratio: 1,
    index: 1,
    modHz: 5,
    deviationHz: 20,
    showModulator: true,
    showBandwidth: true,
  },
  figures: {
    waveform:
      'Waveform. Two cycles of the output, with the modulator behind it as the thinner line.',
    spectrum:
      "Spectrum. The bracket is Carson's rule: the index plus one sidebands each side of the carrier. A stem below the axis, with a hollow marker, is upside down.",
  },
};
