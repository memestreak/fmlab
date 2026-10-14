import type { Operator } from '../dsp/operators';
import { BASE_PATCH } from './basePatch';
import { STEP_WIRINGS } from '../dsp/algorithms';
import type { Chapter, ChapterPatch, Step } from './types';

/** Six operators from a list of [ratio, level, decay]. */
const ops = (...rows: [number, number, number][]): Operator[] =>
  rows.map(([ratio, level, decay]) => ({ ratio, level, decay }));

/** An operator a step wiring leaves out: silent, so it adds nothing. */
const OFF: [number, number, number] = [1, 0, 0];

/** One pair, OP2 on OP1 at an index of 2: where the chapter opens. */
const PAIR: Partial<ChapterPatch> = {
  algorithm: STEP_WIRINGS.pair,
  feedback: 0,
  operators: ops([1, 1, 0], [1, 0.4, 0], OFF, OFF, OFF, OFF),
};

/** A second pair beside the first, three times higher. */
const TWO_PAIRS: Partial<ChapterPatch> = {
  algorithm: STEP_WIRINGS.twoPairs,
  feedback: 0,
  operators: ops([1, 1, 0], [1, 0.4, 0], [3, 0.6, 0], [3, 0.3, 0], OFF, OFF),
};

/** OP3 on OP2 on OP1. */
const STACK: Partial<ChapterPatch> = {
  algorithm: STEP_WIRINGS.stack,
  feedback: 0,
  operators: ops([1, 1, 0], [1, 0.3, 0], [1, 0.3, 0], OFF, OFF, OFF),
};

/** OP2 and OP3 both on OP1, OP3 three times higher. */
const TWO_MODULATORS: Partial<ChapterPatch> = {
  algorithm: STEP_WIRINGS.twoModulators,
  feedback: 0,
  operators: ops([1, 1, 0], [1, 0.3, 0], [3, 0.3, 0], OFF, OFF, OFF),
};

/** The pair again, OP2 fed its own output. */
const FEEDBACK: Partial<ChapterPatch> = {
  algorithm: STEP_WIRINGS.feedback,
  feedback: 0.8,
  operators: ops([1, 1, 0], [1, 0.4, 0], OFF, OFF, OFF, OFF),
};

/**
 * Where the last step starts: algorithm 1, its two stacks held steady, the
 * short one (OP2 on OP1) and the tall one (OP6 on 5 on 4 on 3).
 */
const STACKS: Partial<ChapterPatch> = {
  algorithm: 1,
  feedback: 0,
  operators: ops([1, 1, 0], [1, 0.3, 0], [1, 1, 0], [1, 0.3, 0], [1, 0.25, 0], [1, 0.2, 0]),
};

// The three presets are mine, written for this page; they are not the
// DX7's factory sounds, though they borrow their recipes.

/** Three pairs side by side (algorithm 5): a bell-like tine over a body. */
const PIANO: Partial<ChapterPatch> = {
  algorithm: 5,
  feedback: 0,
  operators: ops([1, 0.9, 2.5], [1, 0.35, 1.2], [1, 0.7, 1.5], [14, 0.25, 0.4], [1, 0.4, 2], [1, 0.15, 1]),
};

/** A tall stack with feedback on top (algorithm 1): a growl an octave down. */
const BASS: Partial<ChapterPatch> = {
  algorithm: 1,
  feedback: 0.7,
  operators: ops([0.5, 1, 1.5], [0.5, 0.45, 0.6], [1, 0.4, 1], [1, 0.35, 0.5], [1, 0.3, 0.4], [1, 0.3, 0.3]),
};

/** Pairs at ratios that are not whole numbers, left to ring (algorithm 5). */
const BELL: Partial<ChapterPatch> = {
  algorithm: 5,
  feedback: 0,
  operators: ops([1, 1, 5], [3.5, 0.5, 4], [2.76, 0.6, 3], [1.4, 0.4, 2.5], [5.4, 0.4, 2], [1.41, 0.3, 1.5]),
};

/** Six carriers, no modulation (algorithm 32): drawbars on an organ. */
const ORGAN: Partial<ChapterPatch> = {
  algorithm: 32,
  feedback: 0,
  operators: ops([0.5, 0.8, 0], [1, 1, 0], [2, 0.7, 0], [3, 0.5, 0], [4, 0.4, 0], [6, 0.3, 0]),
};

const STEPS: Step[] = [
  {
    label: 'One pair',
    title: 'One pair',
    patch: PAIR,
    body: [
      `You have been using a wiring all along. Fig. 1 draws the two
       operators of chapters 3 to 7 the way the DX7 draws them. OP2, the
       modulator, in green, sits above OP1, the carrier, in blue, and a line
       runs down from one to the other because OP2 modulates OP1. Only OP1
       has a line down to <em>out</em>: it is the one you hear.`,
      `A modulator's level is its index: OP2 at 40% is an index of 2. Press
       Play note (or space), then change OP2's level in the table and play
       it again. While a note sounds, each box fills as strongly as its
       operator is sounding.`,
    ],
  },
  {
    label: 'Two pairs',
    title: 'Two pairs side by side',
    patch: TWO_PAIRS,
    body: [
      `Add a second pair beside the first: OP4 modulates OP3, and OP3 is a
       carrier too, with its own line to the output. Two carriers are two
       sounds added together, each with its own sidebands; here the second
       pair is three times higher.`,
      `This is the one rule for every diagram in this chapter:
       <strong>operators on the bottom row are what you hear; everything
       above them only shapes the sound.</strong> A modulator is never
       heard itself, only in what it does to the carrier below it.`,
    ],
  },
  {
    label: 'Stack',
    title: 'A stack',
    patch: STACK,
    body: [
      `Put the third operator on top of the second instead: OP3 modulates
       OP2, which modulates OP1. This is a <strong>stack</strong>. OP2 is no
       longer a plain sine wave but a modulated one, so what it does to OP1
       is richer than any one pair can be. Raise OP3's level and listen to
       the sound thicken far faster than raising an index ever did.`,
    ],
  },
  {
    label: 'Two into one',
    title: 'Two modulators into one carrier',
    patch: TWO_MODULATORS,
    body: [
      `Or wire both modulators into the one carrier: OP2 and OP3 each
       modulate OP1, and their pushes on its phase add up. With OP3 three
       times higher, the spectrum has sidebands spaced by both, and by
       their sums and differences. There is still one carrier, so still one
       sound, but shaped two ways at once.`,
    ],
  },
  {
    label: 'Feedback',
    title: 'Feedback',
    patch: FEEDBACK,
    body: [
      `Last, an operator can modulate itself. Here OP2's own output is fed
       back into its phase, drawn as a line out of its side and back into
       its top. A little <strong>feedback</strong> turns its sine wave
       toward a sawtooth, so the pair grows brighter; a lot turns it to
       noise. Move Feedback: the line thickens as it goes up.`,
    ],
  },
  {
    label: 'All 32',
    title: "The DX7's 32 algorithms",
    patch: STACKS,
    body: [
      `That is all an <strong>algorithm</strong> is: on the DX7, a fixed
       wiring diagram for its six operators, not a procedure to follow. It
       has 32 of them, each with one feedback loop, and you choose one
       rather than wire your own. The list beside Play now has them all,
       grouped by how many carriers each has, which is roughly how many
       sounds it adds together.`,
      `It starts on algorithm 1: a pair on the left, and on the right a
       stack of four. Choose 32 and every operator is a carrier with
       nothing modulating anything, six sine waves added like an organ's
       drawbars; 5 is three pairs side by side. In 4 and 6 the feedback
       loop runs from lower in a stack back up to its top.`,
      `The buttons are sounds of mine to start from, built the way DX7
       sounds are: an electric piano from three pairs, one with a high
       tine; a bass from a tall stack with feedback; a bell from pairs whose
       ratios are not whole numbers.`,
      `Fig. 2 is the spectrum, here and at every step. With more than two
       operators there is no tidy sum of Bessel functions to give the
       heights, so it is worked out the long way: the same maths that makes
       the sound is run for a moment and taken apart into its sine waves.
       Its stems are heights only, all upright. Press Live to see the real
       thing measured.`,
    ],
  },
];

export const operators: Chapter = {
  number: 8,
  title: 'Operators and algorithms',
  navLabel: '8',
  body: [
    `Everything so far has used two sine waves. The Yamaha DX7, the
     synthesizer that took FM out of the laboratory in 1983, has six, which
     it calls <strong>operators</strong>. Each is the same thing as before:
     a sine wave with a frequency (a ratio of the note's pitch), a level,
     and how long it takes to die away; a decay of 0 holds it for the whole
     note.`,
    `What makes a sound is how the operators are wired together. This
     chapter builds that up a step at a time, from the two you know. The
     buttons in the lab and at the head of each section below set each
     step's sound.`,
  ],
  maths: [
    {
      title: 'Six operators',
      body: [
        `Operator <var>k</var> has a ratio <var>r</var><sub><var>k</var></sub>,
         a level <var>L</var><sub><var>k</var></sub> and an envelope
         <var>e</var><sub><var>k</var></sub>(<var>t</var>). Its output is`,
        `<p class="formula"><var>y</var><sub><var>k</var></sub>(<var>t</var>) = <var>L</var><sub><var>k</var></sub> <var>e</var><sub><var>k</var></sub>(<var>t</var>) sin(2π <var>r</var><sub><var>k</var></sub> <var>f</var> <var>t</var> + <var>a</var> Σ<sub><var>j</var> → <var>k</var></sub> <var>y</var><sub><var>j</var></sub>(<var>t</var>))</p>`,
        `where the sum is over the operators <var>j</var> the algorithm
         wires into <var>k</var>, and <var>a</var> = 5: a modulator at full
         level is an index of 5. The sound is the carriers' outputs added
         and divided by how many there are, so every algorithm is about as
         loud.`,
        `Feedback adds <var>β</var> times the loop's source output to its
         target's phase, a sample late (the mean of the last two samples,
         as the DX7 does, which keeps a strong loop from buzzing).`,
      ],
    },
    {
      title: 'Why the spectrum is worked out numerically',
      body: [
        `For two operators the spectrum is a sum of Bessel functions,
         <var>J</var><sub><var>n</var></sub>(<var>I</var>), as chapter 4
         showed. A stack is modulation of a modulated wave, and its spectrum
         is a sum of products of Bessel functions, one factor per operator,
         over every combination of sidebands. That can be written down but
         not usefully drawn from.`,
        `So the predicted spectrum runs the engine's own maths for 16384
         samples, 256 cycles of the note, weights them with a flat-top
         window and takes the fast Fourier transform. Each peak is a
         partial. The window costs some resolution: partials closer than a
         twentieth of the note's pitch run together.`,
      ],
    },
  ],
  controls: ['volume', 'feedback'],
  steps: STEPS,
  presets: [
    { label: 'Stacks', hint: 'algorithm 1, held', patch: STACKS },
    { label: 'E. piano', hint: 'three pairs, algorithm 5', patch: PIANO },
    { label: 'Bass', hint: 'a stack with feedback, algorithm 1', patch: BASS },
    { label: 'Bell', hint: 'pairs not in whole ratios, algorithm 5', patch: BELL },
    { label: 'Organ', hint: 'six carriers, algorithm 32', patch: ORGAN },
  ],
  hasMotion: false,
  patch: {
    ...BASE_PATCH,
    ...PAIR,
    mode: 'ops',
    noteMode: true,
  },
  figures: {
    algorithm:
      'The wiring. Carriers along the bottom, heard; modulators above what they modulate.',
    spectrum:
      'Spectrum, worked out numerically: heights only.',
  },
};
