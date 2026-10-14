import { BASE_PATCH } from './basePatch';
import type { Chapter } from './types';

export const singleSine: Chapter = {
  number: 1,
  title: 'A single sine',
  navLabel: '1',
  body: [
    `Every sound in this guide is built from the plainest sound there is: a
     sine wave. Press Play to hear one. There are only two things about it
     you can change.`,
    `<strong>Frequency</strong> is how many times a second the wave
     repeats, counted in hertz (Hz). You hear it as pitch. At 220 Hz this
     is the A below middle C; double it to 440 Hz and the pitch rises an
     octave. Move Carrier and listen.`,
    `Fig. 1 draws the wave itself over 20 milliseconds, a fiftieth of a
     second. At 220 Hz a little over four swings fit. Move Carrier up and
     more crowd in; move it down and they spread out. A higher pitch is
     the same shape, repeating sooner.`,
    `<strong>Amplitude</strong> is how far the wave swings, and you hear
     it as loudness. Volume changes it. The figures draw the wave at full
     height whatever the volume, so they can stay the same size.`,
    `Fig. 2 shows the same sound a second way. A spectrum has one stem for
     every sine wave in a sound, standing at that wave's frequency and as
     tall as its amplitude. One sine wave is one stem, and it slides along
     the axis as you move Carrier. More interesting sounds have many, and the rest of this guide is about how FM grows
     them from just two sine waves.`,
    `This sine is called the carrier, because in the next chapter a second
     wave starts pushing it around.`,
  ],
  maths: [
    {
      title: 'A sine wave as a formula',
      body: [
        `<p class="formula"><var>x</var>(<var>t</var>) = <var>A</var> sin(2π <var>f</var> <var>t</var>)</p>`,
        `<var>A</var> is the amplitude, <var>f</var> the frequency in Hz
         and <var>t</var> the time in seconds. One cycle lasts
         <var>T</var> = 1 / <var>f</var>: at 220 Hz that is 4.55 ms, so
         4.4 of them fit in the 20 ms of Fig. 1.`,
        `The spectrum is the same information turned round. It answers
         "which frequencies, and how much of each?" where the waveform
         answers "how far, and when?". For one sine the answer is a single
         stem of height <var>A</var> at <var>f</var>.`,
      ],
    },
  ],
  controls: ['volume', 'carrier'],
  presets: [],
  hasMotion: false,
  patch: {
    ...BASE_PATCH,
    // No modulator: one sine wave, on axes in real units.
    index: 0,
    deviationHz: 0,
    showModulator: false,
    realUnits: true,
  },
  figures: {
    waveform: 'Waveform. Twenty milliseconds of the sine wave.',
    spectrum: 'Spectrum. One sine wave is one stem, at its frequency.',
  },
};
