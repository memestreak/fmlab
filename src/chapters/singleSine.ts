import { BASE_PATCH } from './basePatch';
import { define, formula } from './terms';
import { titleOf } from './outline';
import type { Chapter } from './types';

export const singleSine: Chapter = {
  id: 'sine',
  title: titleOf('sine'),
  body: [
    `Every sound in this guide is built from one kind of wave.
     ${define('sineWave')} Press Play to hear one. ${define('carrier')}
     There are only two things about it you can change.`,
    `${define('frequency')} ${define('octave')} At 220 Hz this is the A
     below middle C, and at 440 Hz the A an octave above it. Move Carrier
     and listen.`,
    `${define('waveform')} Fig. 1 is this one's, over 20 milliseconds, a
     fiftieth of a second. At 220 Hz a little over four swings fit. Move
     Carrier up and more crowd in; move it down and they spread out. A
     higher pitch is the same shape, repeating sooner.`,
    `${define('amplitude')} Volume changes it. The figures draw the wave at
     full height whatever the volume, so they can stay the same size.`,
    `Fig. 2 shows the same sound a second way. ${define('spectrum')} One
     sine wave is one stem, and it slides along the axis as you move
     Carrier. More interesting sounds have many. ${define('partial')} The
     rest of this guide is about growing many partials from just two sine
     waves.`,
  ],
  maths: [
    {
      title: 'A sine wave as a formula',
      body: [
        formula('sineWave'),
        `<var>A</var> is the amplitude, <var>f</var> the frequency in Hz
         and <var>t</var> the time in seconds. One cycle lasts
         <var>T</var> seconds, and the frequency is how many fit in one:`,
        formula('frequency'),
        `At 220 Hz a cycle is 4.55 ms, so 4.4 of them fit in the 20 ms of
         Fig. 1.`,
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
