import { BASE_PATCH } from './basePatch';
import { define, formula, use, wikipedia } from './terms';
import { sectionLink, titleOf } from './outline';
import type { Chapter } from './types';

export const fmVsPm: Chapter = {
  id: 'fm-vs-pm',
  title: titleOf('fm-vs-pm'),
  body: [
    `The DX7 is sold as an FM synthesizer, and this guide has called its
     sound FM. Strictly, though, it is something slightly different. To
     see what, you need one more idea about a wave.`,
    `A sine wave goes round and round a cycle: up, down and back to where
     it began. How far through that cycle it is at a given moment is its
     ${define('phase')}, measured as an angle, like the hand of a clock.
     Two waves at the same frequency can be at different phases, one a
     little ahead of the other.`,
    `The angle is counted not in degrees but in a unit where a whole cycle
     is 2π, about 6.28: the ${define('radian')}. So one radian is a little
     under a sixth of a cycle.`,
    `Here is the reveal. Every section since ${sectionLink('index')}, and the DX7
     itself, has added the modulator to the carrier's phase, not to its
     frequency. One wave pushing another's phase back and forth like this
     is ${define('pm')}, or PM. It has been PM all along; only
     ${sectionLink('vibrato')} was true FM. The index is simply how far
     the phase is pushed, in radians.`,
    `Why the DX7 does it this way is easiest to see side by side. Fig. 1 is
     phase modulation, as in the two-operator sections: the modulator
     pushes the carrier's phase by up to Index radians. Fig. 2 is true
     ${use('fm')}, matched to it at a ratio of 1: the modulator pushes the
     carrier's frequency by up to Index times the carrier's frequency. At
     ratio 1 the two have the same index, and much the same spectrum. Press
     Play, and use the switch beside it to hear one or the other.`,
    `Now move <strong>Ratio</strong>. In Fig. 1 the sidebands spread apart
     as the modulator speeds up, but there are as many of them as before:
     the index, and so the brightness, stays where Index puts it. In
     Fig. 2 they spread too, but thin out. A push of so many hertz is a
     smaller index when the modulator is faster (the index is the push
     over the modulator's frequency), and a larger one when it is slower:
     take Ratio below 1 and frequency modulation turns dense and bright.`,
    `So with true FM, retuning a modulator changes how bright the sound
     is; with phase modulation pitch and brightness are separate dials, a
     ratio and a level. That is much of why the DX7, and nearly every
     "FM" instrument since, is built on phase modulation.`,
    `The other reason shows up in stacks and feedback. A modulator that is
     itself modulated, or fed its own output, is no longer centred on
     zero. Added to a frequency, any offset is a change of pitch, and the
     carrier drifts out of tune. Added to a phase, it is only a nudge, and
     the note stays where it was played.`,
  ],
  maths: [
    {
      title: 'The two, side by side',
      body: [
        `${wikipedia('Phase_modulation', 'Phase modulation')} adds the
         modulator to the phase:`,
        formula('pm'),
        `<var>I</var> is the index: the furthest the phase is pushed, in
         radians, where`,
        formula('radian'),
        `Frequency modulation adds it to the frequency, so the phase is the
         frequency added up over time, as in ${sectionLink('vibrato')}:`,
        `<p class="formula"><var>x</var><sub>FM</sub>(<var>t</var>) = sin(2π <var>f</var><sub>c</sub> <var>t</var> + (Δ<var>f</var> / <var>f</var><sub>m</sub>)(1 − cos 2π <var>f</var><sub>m</sub> <var>t</var>))</p>`,
        `The two are the same shape of signal with the modulator a quarter
         cycle apart, and with index Δ<var>f</var> / <var>f</var><sub>m</sub>
         in place of <var>I</var>. Here Δ<var>f</var> = <var>I</var>
         <var>f</var><sub>c</sub>, so frequency modulation's index is
         <var>I</var> / <var>r</var>, where <var>r</var> is the ratio: equal
         to phase modulation's at <var>r</var> = 1, and inversely
         proportional to the ratio everywhere else.`,
      ],
    },
    {
      title: 'Why an offset detunes FM and not PM',
      body: [
        `Suppose the modulator has a constant part <var>c</var> on top of
         its swing, as a modulated or fed-back operator does. In phase
         modulation it adds a constant phase, 
         <var>c</var>, which cannot be heard. In frequency modulation it
         adds <var>c</var> hertz to the frequency, and so
         2π <var>c</var> <var>t</var> to the phase, a phase that grows
         without end: the note is <var>c</var> Hz sharp or flat.`,
      ],
    },
  ],
  controls: ['volume', 'ratio', 'index'],
  presets: [],
  hasMotion: false,
  patch: {
    ...BASE_PATCH,
    compare: true,
    // Heard as phase modulation to begin with; the switch sets 'fm'.
    mode: 'pm',
    ratio: 1,
    index: 2,
    // Kept in step with ratio and index by ui/compare.ts, for the sound.
    modHz: 220,
    deviationHz: 440,
  },
  figures: {
    spectrum: 'Phase modulation: the index stays put as the ratio moves.',
    compare: 'Frequency modulation: its index is Index over Ratio.',
  },
};
