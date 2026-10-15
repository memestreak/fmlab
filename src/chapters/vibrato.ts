import { BASE_PATCH } from './basePatch';
import { define, formula, wikipedia } from './terms';
import { sectionLink, titleOf } from './outline';
import type { Chapter } from './types';

export const vibrato: Chapter = {
  id: 'vibrato',
  title: titleOf('vibrato'),
  body: [
    `Press Play. This is a sine wave again, but its pitch now slides slowly
     up and down, once every two seconds. A regular wobble in pitch like
     this is ${define('vibrato')}; a violinist makes a faster one, about
     five times a second, by rocking a finger on the string.`,
    `What moves the pitch is a second sine wave, running at 0.5 Hz, far
     too slow to hear as a note. It is the ${define('modulator')}: you never
     hear it, only what it does to the first wave. Fig. 1 draws it behind
     the sound as the thinner line. Where it is high the waves crowd
     together and the pitch is up; where it is low they spread out.`,
    `The wave you hear, the one being pushed around, is the
     ${define('carrier')}. While the sound plays, Fig. 1 moves with it.
     The carrier is drawn slowed down so that each of its waves can be
     seen; the figure's caption says by how much.`,
    `How far the modulator pushes the carrier's frequency each way, in Hz,
     is its ${define('deviation')}. At 20 the carrier swings between 200
     and 240 Hz. Move Deviation down to 0 and the wobble stops; move it up
     and the wobble widens.`,
    `Move Modulator up to about 5 Hz and the wobble speeds up to a
     violinist's. One
     wave pushing another's frequency up and down like this is
     ${define('fm')}, FM for short.`,
    `Now the moment this guide is built on. Drag
     <strong>Modulator</strong> slowly to the right. Past about 20 Hz the
     wobble is too fast to follow and turns into a roughness, a growl.
     (The figure stops moving a little before that, and from there shows
     two whole wobbles standing still, at the carrier's true speed.) Keep
     going into the hundreds and the wobble is gone altogether: you hear
     one steady note with a new, brighter colour. Nothing changed but the
     speed, and a movement of pitch has become the sound's
     ${define('timbre')}: its colour, what tells a flute from a violin
     playing the same note.`,
    `Fig. 2 shows why. Modulating a sine wave's frequency puts new stems on
     both sides of the carrier, in pairs, one modulator frequency apart.
     Each is a ${define('sideband')}. At 0.5 Hz they huddle so close to the
     carrier that the ear cannot tell them apart and hears one pitch that
     moves. As the modulator speeds up they spread out, until the ear
     hears each as a partial of its own, and the moving pitch has turned
     into a change of colour.`,
    `${wikipedia('John_Chowning', 'John Chowning')} came upon this at
     Stanford in 1967, pushing vibrato faster and deeper than any player
     could, and published it in 1973 as "The Synthesis of Complex Audio
     Spectra by Means of Frequency Modulation". A handful of sine waves
     could now stand in for a whole bank of them. Ten years later it was
     the sound of the ${wikipedia('Yamaha_DX7', 'Yamaha DX7')}.`,
  ],
  maths: [
    {
      title: 'Frequency modulation as a formula',
      body: [
        `The carrier's frequency is no longer fixed. It follows the
         modulator:`,
        formula('fm'),
        `<var>f</var><sub>c</sub> is the carrier's frequency,
         <var>f</var><sub>m</sub> the modulator's and Δ<var>f</var> the
         deviation. Adding the frequency up over time gives the signal:`,
        `<p class="formula"><var>x</var>(<var>t</var>) = sin(2π <var>f</var><sub>c</sub> <var>t</var> + (Δ<var>f</var> / <var>f</var><sub>m</sub>) (1 − cos 2π <var>f</var><sub>m</sub> <var>t</var>))</p>`,
        `The sidebands stand at`,
        formula('sideband'),
        `and roughly Δ<var>f</var> / <var>f</var><sub>m</sub> + 1 of them
         on each side are big enough to matter. That is why slow vibrato
         makes such a dense clump: at 5 Hz a 20 Hz deviation gives about
         five each side, and at 0.5 Hz about forty.`,
      ],
    },
    {
      title: 'Why this section is different under the bonnet',
      body: [
        `Every other section pushes the carrier a slightly different way,
         the way the DX7 does. The two make the same family of sounds.`,
        `The difference is what stays put when the modulator's speed
         changes. Here the deviation in Hz is fixed, as it is for a
         violinist's finger, so a slower modulator makes a denser clump.
         The other way, a slow modulator would barely move the pitch at
         all. ${sectionLink('fm-vs-pm')} puts the two side by side.`,
      ],
    },
  ],
  controls: ['volume', 'modHz', 'deviation'],
  presets: [],
  patch: {
    ...BASE_PATCH,
    mode: 'fm',
    // A slow slide, the bottom of the Modulator slider: one sweep up and
    // down every two seconds, easy to follow by ear and in Fig. 1.
    modHz: 0.5,
    deviationHz: 20,
  },
  figures: {
    waveform:
      'Waveform. The output, and behind it as the thinner line the modulator, which is the pitch rising and falling.',
    spectrum:
      'Spectrum. The carrier and its sidebands, one modulator frequency apart.',
  },
};
