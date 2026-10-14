import { BASE_PATCH } from './basePatch';
import { define, formula } from './terms';
import { sectionLink, titleOf } from './outline';
import type { Chapter, ChapterPatch } from './types';

/** Chowning's brass: 1:1, the index swelling and fading with the note. */
const BRASS: Partial<ChapterPatch> = {
  carrierHz: 440,
  ratio: 1,
  index: 5,
  attack: 0.1,
  decay: 0.1,
  sustain: 0.75,
  release: 0.15,
  hold: 0.6,
};

/** His bell: partials that do not line up, struck and left to ring. */
const BELL: Partial<ChapterPatch> = {
  carrierHz: 200,
  ratio: 1.4,
  index: 10,
  attack: 0.005,
  decay: 5,
  sustain: 0,
  release: 0.5,
  hold: 5,
};

export const envelope: Chapter = {
  id: 'envelopes',
  title: titleOf('envelopes'),
  body: [
    `Every sound so far has been frozen: one index, one spectrum, held for
     as long as you like. No instrument does that. A trumpet note starts
     dull, blooms bright as the player pushes, and darkens as it fades. A
     bell is brightest at the instant it is struck and loses its high
     partials first.`,
    `FM does this with one move: change the index while the note sounds.
     Press <strong>Play note</strong>, or the space bar.`,
    `${define('envelope')} Fig. 1 is this note's. ${define('adsr')} Drag
     the three dots, or use the sliders. The heavier line is the
     loudness. The thinner one is the index, the modulator's push; here
     the two move together.`,
    `${define('spectrogram')} Fig. 2 is this note's: the spectrum of the earlier sections turned on its side and stretched out along it. Watch the upper partials arrive as the envelope
     rises and leave as it falls.`,
    `Untick <strong>Index follows the envelope</strong> and play again.
     Now only the loudness changes. The colour stands still, and the note
     sounds like an organ key, not a breath. That difference is the whole
     trick.`,
    `The two buttons are John Chowning's own recipes from 1973.
     <strong>Brass</strong> is a ratio of 1:1 with the index rising and
     falling with the loudness, so the note brightens as it swells.
     <strong>Bell</strong> is partials that do not line up, at 1:1.4,
     struck all at once and left to ring, the index sinking with the
     loudness so that the clang mellows into a hum.`,
  ],
  maths: [
    {
      title: 'The envelope',
      body: [
        `Write <var>e</var>(<var>t</var>) for the envelope, a number
         between 0 and 1 that changes over the note. The signal is the one from ${sectionLink('index')} with both its loudness and its index following
         it:`,
        formula('envelope'),
        `<var>I</var> is the Index slider: the index at the envelope's
         peak. Since the number of sidebands that matter is about the
         index plus one, the sound's bandwidth follows the envelope too.
         That is the widening and narrowing in Fig. 2.`,
        `Here the attack is a straight line. The decay and the release are
         exponential, falling fast at first and then ever more slowly, as
         a struck or blown thing does. Such a curve never quite arrives,
         so its time is counted to within 2% of where it is going.`,
      ],
    },
    {
      title: "Chowning's settings",
      body: [
        `From "The Synthesis of Complex Audio Spectra by Means of
         Frequency Modulation" (1973). Brass: carrier to modulator 1:1,
         the index rising to 5, a note of 0.6 seconds, one envelope for
         loudness and index both. Bell: a 200 Hz carrier with a 280 Hz
         modulator, 1:1.4, the index falling from 10 to 0 and the loudness
         dying away exponentially over 15 seconds. The bell here rings for
         five.`,
      ],
    },
  ],
  controls: ['volume', 'index', 'attack', 'decay', 'sustain', 'release'],
  presets: [
    { label: 'Brass', hint: "Chowning's brass", patch: BRASS },
    { label: 'Bell', hint: "Chowning's bell", patch: BELL },
  ],
  showsPair: true,
  hasMotion: false,
  patch: {
    ...BASE_PATCH,
    ...BRASS,
    noteMode: true,
  },
  figures: {
    envelope:
      "Envelope. The note's loudness over time, and as the thinner line its index. Drag the dots to change the attack, the decay and sustain, and the release.",
    spectrogram:
      'Spectrogram. Each partial over the length of the note: time left to right, frequency upward, bolder where stronger.',
  },
};
