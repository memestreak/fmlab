import { BASE_PATCH } from './basePatch';
import { define, formula } from './terms';
import { titleOf } from './outline';
import type { Chapter } from './types';

export const singleSine: Chapter = {
  id: 'sine',
  title: titleOf('sine'),
  body: [
    `Every sound in this guide is built from one kind of wave. Press Play:
     one pure, even tone, with nothing else in it. Its shape is the sine
     curve, swinging smoothly back and forth, so it is called a
     ${define('sineWave')}. There are only two things about it you can
     change.`,
    `Move the slider under Volume and the pitch goes up and down. What it
     changes is how many times a second the wave repeats: its
     ${define('frequency')}, counted in hertz (Hz), which is what the
     slider is called. You hear frequency as pitch.`,
    `At 220 Hz this is the A below middle C. Take it up to 440 Hz and you
     hear the A above it: the same note, higher. Doubling the frequency
     always gives that same note again, and the step it takes is an
     ${define('octave')}.`,
    `Fig. 1 draws the sound as its height against time, over 20
     milliseconds, a fiftieth of a second. That drawing is its
     ${define('waveform')}. At 220 Hz a little over four swings fit. Move
     Frequency up and more crowd in; move it down and they spread out.
     A higher pitch is the same shape, repeating sooner.`,
    `Volume changes how far the wave swings either side of zero. That is
     its ${define('amplitude')}, and you hear it as loudness. The figures
     draw the wave at full height whatever the volume, so they can stay
     the same size.`,
    `Fig. 2 shows the same sound a second way. It shows the sine waves a
     sound is made of, one stem for each, standing at that wave's
     frequency and as tall as its amplitude. This view is the sound's
     ${define('spectrum')}. One sine wave is one stem, and it slides along
     the axis as you move Frequency.`,
    `More interesting sounds have many stems. Each one is a
     ${define('partial')}: one of the sine waves the sound is made of. The
     rest of this guide is about growing many partials from just two sine
     waves.`,
    `Fig. 2 is worked out from the settings: what the sound should
     contain. Press Live in its caption and it measures what is really
     coming out, while it plays, and draws that over the predicted stem.
     The measuring is done by the ${define('fft')} (FFT), the standard way
     to take a stretch of sound apart into the sine waves it is made of.
     The two should agree.`,
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
  // There is no carrier yet: the slider sets the one wave's frequency.
  labels: { carrier: 'Frequency' },
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
