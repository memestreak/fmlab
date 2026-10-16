import { BASE_PATCH } from './basePatch';
import { DX7_PRESETS, ops, STACKS } from './dx7Presets';
import { STEP_WIRINGS } from '../dsp/algorithms';
import { define, use, wikipedia } from './terms';
import { sectionLink, titleOf } from './outline';
import type { Chapter, ChapterPatch, Step } from './types';

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

const STEPS: Step[] = [
  {
    label: 'One pair',
    title: 'One pair',
    patch: PAIR,
    body: [
      `You have been using a wiring all along. Fig. 1 draws the two operators you have used since ${sectionLink('index')} the way the DX7 draws them. OP2, the
       modulator, in green, sits above OP1, the carrier, in blue, and a line
       runs down from one to the other because OP2 modulates OP1. Only OP1
       has a line down to <em>out</em>: it is the one you hear.`,
      `The lab has two panels, one above the other. Algorithm is the
       wiring: a button for each step of this section, and the diagram.
       Operators is the operators it wires, a row each,
       ringed in blue or green as their boxes are. Point at a row and its
       box is ringed in the diagram; point at a box and its row is picked
       out.`,
      `Each operator has a level, a percentage. For a carrier it is how
       loud it is. For a modulator it is how hard it pushes, its index:
       full level is an index of 5, so OP2 at 40% is an index of 2. Press
       Play note (or space), then drag OP2's Level slider, or drag up or
       across in the box beside it, or click in the box and type, and play
       it again. While a note sounds, each box
       fills as strongly as its operator is sounding.`,
    ],
  },
  {
    label: 'Two pairs',
    title: 'Two pairs side by side',
    patch: TWO_PAIRS,
    body: [
      `Add a second pair beside the first: OP4 modulates OP3, and OP3 is a
       carrier too, with its own line to the output. Two carriers are two
       sounds added together, each with its own sidebands. Here the second
       pair has ratios of 3, so it sounds three times higher.`,
      `This is the one rule for every diagram in this section:
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
       OP2, which modulates OP1. ${define('stack')} OP2 is no
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
       modulate OP1, and their pushes add up. With OP3 three
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
      `One more wiring is left. Here OP2 modulates itself: its own output
       goes back in, drawn as a line out of its side and into its top. That
       loop is ${define('feedback')}. A little turns its sine wave toward a sawtooth, so the pair grows
       brighter; a lot turns it to noise. Move Feedback: the line thickens
       as it goes up.`,
    ],
  },
  {
    label: 'DX7 algorithms',
    title: 'DX7 algorithms',
    patch: STACKS,
    body: [
      `That is all there is to it. The DX7 has 32
       ${use('algorithm', 'algorithms')}, each with one feedback loop, and
       you choose one rather than wire your own. The DX7 algorithms button
       swaps the step buttons for a list of all 32, grouped by how many
       carriers each has, which is roughly how many sounds it adds
       together. Basic wirings brings the step buttons back.`,
      `It starts on algorithm 1: a pair on the left, and on the right a
       stack of four. Choose 32 and every operator is a carrier with
       nothing modulating anything, six sine waves added like an organ's
       drawbars; 5 is three pairs side by side. In 4 and 6 the feedback
       loop runs from lower in a stack back up to its top.`,
      `${sectionLink('sandbox', 'The sandbox')}, at the end of the guide, has all of this too: switch it to Six to play these sounds from a keyboard and share them by
       link.`,
      `The buttons beside the list are sounds of mine to start from, built the way DX7
       sounds are: an electric piano from three pairs, one with a high
       tine; a bass from a tall stack with feedback; a bell from pairs whose
       ratios are not whole numbers.`,
      `Fig. 2 is the spectrum, here and at every step. With more than two
       operators there is no tidy sum of Bessel functions to give the
       heights, so it is worked out the long way: the same maths that makes
       the sound is run for a moment, and the result taken apart
       with the same ${use('fft', 'FFT')} that measures the sound as it
       plays. Its stems are heights only, all upright. Play a note to see
       the real thing measured over them.`,
    ],
  },
];

export const operators: Chapter = {
  id: 'algorithms',
  title: titleOf('algorithms'),
  body: [
    `So far one wave bends another. What if a third wave bends the second?
     The ${wikipedia('Yamaha_DX7', 'Yamaha DX7')}, the synthesizer that
     took ${use('fm', 'FM')} out of the laboratory in 1983, lets you find
     out: it has six sine waves to wire together. Each is an
     ${define('operator')}, the DX7's name for a sine wave with its own
     frequency, level and ${use('envelope')}, which can be a carrier or a
     modulator.`,
    `The DX7 numbers its operators OP1 to OP6; the numbers are its own,
     and say nothing about pitch. Each operator's frequency is set as a
     multiple of the note's, which the DX7 also calls its ratio: a carrier
     at 1 with a modulator at 2 is the 1:2 of ${sectionLink('ratio')}. Its
     Ratio slider, and a drag in its box, snap to whole numbers and a
     half; hold Shift for the steps between, or type one in the box. Its envelope here is one
     number, how long it takes to die away; a decay of 0 holds it for the
     whole note.`,
    `What makes a sound is how the operators are wired together: which
     modulate which, and which are heard. A wiring like that is an
     ${define('algorithm')}, a diagram rather than a procedure to follow.
     This section builds one up a step at a time, from the two operators
     you know. The buttons in the Algorithm panel and at the head of each
     section below set each step's sound.`,
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
        `Feedback adds <var>β</var> times the loop's source output to what
         modulates its target, a sample late (the mean of the last two samples,
         as the DX7 does, which keeps a strong loop from buzzing).`,
      ],
    },
    {
      title: 'Why the spectrum is worked out numerically',
      body: [
        `For two operators the spectrum is a sum of Bessel functions,
         <var>J</var><sub><var>n</var></sub>(<var>I</var>), as ${sectionLink('sidebands')} showed. A stack is modulation of a modulated wave, and its spectrum
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
  presets: DX7_PRESETS,
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
