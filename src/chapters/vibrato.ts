import type { Chapter } from './types';

export const vibrato: Chapter = {
  number: 2,
  title: 'Vibrato becomes timbre',
  navLabel: '2',
  body: [
    `Now a second sine wave, the modulator, pushes the carrier's frequency
     up and down. Press Play. The modulator runs at 5 Hz, five times a
     second, and what you hear is vibrato: the wobble a violinist makes by
     rocking a finger on the string.`,
    `<strong>Deviation</strong> is how far the pitch is pushed each way,
     in Hz. At 20 the carrier swings between 200 and 240 Hz. While the
     sound plays, Fig. 1 moves with it. The thinner line is the modulator,
     which here is the pitch: where it is high the carrier's waves crowd
     together, and where it is low they spread out. The carrier is drawn
     slowed down, so that each of its waves can be seen; the figure's
     caption says by how much. Tick Show motion to watch it without the
     sound.`,
    `Now drag <strong>Modulator</strong> slowly to the right. Past about
     20 Hz the wobble is too fast to follow and turns into a roughness, a
     growl. (The figure stops moving a little before that, and from there
     shows two whole wobbles standing still, at the carrier's true speed.) Keep going into the hundreds and the wobble is gone
     altogether: you hear one steady note with a new, brighter colour.
     Nothing changed but the speed.`,
    `Fig. 2 shows why. Modulating a sine wave's frequency puts new stems,
     called sidebands, on both sides of the carrier, spaced apart by the
     modulator's frequency. At 5 Hz they huddle so close to the carrier
     that the ear cannot tell them apart and hears one pitch that moves.
     As the modulator speeds up they spread out, until the ear hears each
     as a partial of its own. A moving pitch has become a timbre.`,
    `John Chowning came upon this at Stanford in 1967, pushing vibrato
     faster and deeper than any player could, and published it in 1973 as
     "The Synthesis of Complex Audio Spectra by Means of Frequency
     Modulation". A handful of sine waves could now stand in for a whole
     bank of them. Ten years later it was the sound of the Yamaha DX7.`,
  ],
  maths: [
    {
      title: 'Frequency modulation as a formula',
      body: [
        `The carrier's frequency is no longer fixed. It follows the
         modulator:`,
        `<p class="formula"><var>f</var>(<var>t</var>) = <var>f</var><sub>c</sub> + Δ<var>f</var> sin(2π <var>f</var><sub>m</sub> <var>t</var>)</p>`,
        `<var>f</var><sub>c</sub> is the carrier's frequency,
         <var>f</var><sub>m</sub> the modulator's and Δ<var>f</var> the
         deviation. A wave's phase is its frequency added up over time,
         which gives the signal:`,
        `<p class="formula"><var>x</var>(<var>t</var>) = sin(2π <var>f</var><sub>c</sub> <var>t</var> + <var>I</var> (1 − cos 2π <var>f</var><sub>m</sub> <var>t</var>))</p>`,
        `<p class="formula"><var>I</var> = Δ<var>f</var> / <var>f</var><sub>m</sub></p>`,
        `<var>I</var> is the modulation index. The sidebands stand at
         <var>f</var><sub>c</sub> ± <var>n</var> <var>f</var><sub>m</sub>
         for every whole number <var>n</var>, and roughly
         <var>I</var> + 1 of them on each side are big enough to matter.
         That is why slow vibrato makes such a dense clump: at 5 Hz a
         20 Hz deviation is an index of 4, and at 0.5 Hz it is 40.`,
      ],
    },
    {
      title: 'Why this chapter is different under the bonnet',
      body: [
        `Everywhere else this guide uses phase modulation, as the DX7
         does: the modulator is added to the carrier's phase, not to its
         frequency. The two make the same family of sounds, and with
         <var>I</var> = Δ<var>f</var> / <var>f</var><sub>m</sub> their
         sidebands are the same heights.`,
        `The difference is what stays put when the modulator's speed
         changes. Here the deviation in Hz is fixed, as it is for a
         violinist's finger, so slowing the modulator raises the index.
         With phase modulation the index is fixed instead, and a slow
         modulator would barely move the pitch at all. A later chapter
         puts the two side by side.`,
      ],
    },
  ],
  controls: ['volume', 'modHz', 'deviation'],
  hasMotion: true,
  patch: {
    mode: 'fm',
    carrierHz: 220,
    ratio: 1,
    index: 0,
    modHz: 5,
    deviationHz: 20,
    showModulator: true,
  },
  captions: {
    waveform:
      'Waveform. The output, and behind it as the thinner line the modulator, which is the pitch rising and falling.',
    spectrum:
      'Spectrum. The carrier and its sidebands, one modulator frequency apart.',
  },
};
