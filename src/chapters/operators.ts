import type { Operator } from '../dsp/operators';
import { BASE_PATCH } from './basePatch';
import type { Chapter, ChapterPatch } from './types';

/** Six operators from a list of [ratio, level, decay]. */
const ops = (...rows: [number, number, number][]): Operator[] =>
  rows.map(([ratio, level, decay]) => ({ ratio, level, decay }));

/**
 * Where the chapter starts: algorithm 1, its two stacks held steady, the
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

export const operators: Chapter = {
  number: 8,
  title: 'Operators and algorithms',
  navLabel: '8',
  body: [
    `Everything so far has used two sine waves. The Yamaha DX7, the
     synthesizer that took FM out of the laboratory in 1983, has six, which
     it calls <strong>operators</strong>. Each is the same thing as before:
     a sine wave with a frequency (a ratio of the note's pitch), a level,
     and an envelope that shapes the level over the note. Here the envelope
     is one number, how long the operator takes to die away; 0 holds it for
     the whole note.`,
    `What makes a sound is how the six are wired, and Fig. 1 draws the
     wiring: an <strong>algorithm</strong>. An operator on the bottom row,
     outlined in blue, is a carrier, and is heard. One above it, in green,
     modulates it, the way the modulator did in every chapter so far. The
     DX7 has 32 fixed algorithms; choose one from the list. The table says
     which operators each makes carriers and which modulators.`,
    `It opens on algorithm 1. Press Play note. On the left OP2 modulates
     OP1, the two-operator sound of the earlier chapters. On the right is a
     <strong>stack</strong>: OP6 modulates OP5, which modulates OP4, which
     modulates OP3. A modulator that is itself modulated is no longer a sine
     wave, so what it does to the operator below is richer than any one
     pair can be. Raise the levels of OP4, OP5 and OP6 and listen to the
     sound thicken far faster than raising an index ever did.`,
    `Now choose 32. Every operator is a carrier and nothing modulates
     anything: six sine waves added together, like the drawbars of an
     organ. The Organ button sets their ratios to the first few harmonics.
     Between these two ends are the rest: 5, for instance, is three pairs
     side by side, three two-operator sounds at once.`,
    `Every algorithm also has one <strong>feedback</strong> loop, drawn as a
     line from an operator back into itself (in 4 and 6, back up to the top
     of a stack). An operator fed its own output bends its own phase. A
     little turns its sine wave toward a sawtooth; a lot turns it to noise.
     The line thickens as Feedback goes up.`,
    `The other buttons are three sounds of mine to start from, built the
     way DX7 sounds are: an electric piano from three pairs, one with a
     high tine; a bass from a tall stack with feedback; a bell from pairs
     whose ratios are not whole numbers.`,
    `Fig. 2 is the spectrum. With more than two operators there is no tidy
     sum of Bessel functions to give the heights, so it is worked out the
     long way: the same maths that makes the sound is run for a moment and
     taken apart into its sine waves. Its stems are heights only, all
     upright. Press Live to see the real thing measured.`,
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
    ...STACKS,
    mode: 'ops',
    noteMode: true,
  },
  figures: {
    algorithm:
      'Algorithm. Carriers along the bottom, modulators above what they modulate, and the feedback loop.',
    spectrum:
      'Spectrum, worked out numerically: heights only.',
  },
};
