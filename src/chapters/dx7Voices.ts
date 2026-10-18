import {
  type Dx7Envelope,
  type Dx7Operator,
  HELD_ENVELOPE,
  heldOperator,
  type ScalingSide,
} from '../dsp/dx7';
import type { ChapterPatch, Preset } from './types';

// The sandbox's sounds to start from, in its DX7 voice (dsp/dx7.ts).
// E. piano, Bass, Bell and Marimba are set by hand "after" the DX7's
// factory E. PIANO 1, BASS 1, TUB BELLS and MARIMBA: the same kind of
// wiring and the same idea, not Yamaha's patch data, and not the same
// sound. Each says so in its hint.

/** An envelope: attack, peak, decay 1, break, decay 2, sustain, release. */
const env = (
  attack: number,
  peak: number,
  decay1: number,
  brk: number,
  decay2: number,
  sustain: number,
  release: number,
): Dx7Envelope => ({ attack, peak, decay1, brk, decay2, sustain, release });

const flat: ScalingSide = { curve: 'lin', depth: 0 };

/** An operator, held and unscaled unless `rest` says otherwise. */
const op = (
  ratio: number,
  level: number | null,
  envelope: Dx7Envelope = HELD_ENVELOPE,
  rest: Partial<Dx7Operator> = {},
): Dx7Operator => ({ ...heldOperator(ratio, level), envelope, ...rest });

/** Quieter up the keyboard, from middle C: a brightness that thins as it rises. */
const thinner = (depth: number): Partial<Dx7Operator> => ({
  breakKey: 60,
  left: flat,
  right: { curve: 'lin', depth: -depth },
});

/**
 * Algorithm 1, its two stacks held steady: the short one (OP2 on OP1) and
 * the tall one (OP6 on 5 on 4 on 3). Where the sandbox starts.
 */
export const DX7_STACKS: Partial<ChapterPatch> = {
  algorithm: 1,
  dxFeedback: 0,
  dxOperators: [op(1, 0), op(1, -18.5), op(1, 0), op(1, -18.5), op(1, -22), op(1, -22)],
};

/** Three pairs side by side, a bright tine over the body, each a little detuned. */
const PIANO: Partial<ChapterPatch> = {
  algorithm: 5,
  dxFeedback: Math.PI,
  dxOperators: [
    op(1, -0.9, env(0.002, 0, 1.2, -12, 6, -48, 0.4), { rateScaling: 1.3 }),
    op(1, -9.1, env(0.002, 0, 0.6, -14, 2.5, -40, 0.3), { detune: 2, ...thinner(1.5), rateScaling: 1.3 }),
    op(1, -3.1, env(0.002, 0, 1.2, -12, 6, -48, 0.4), { detune: -2, rateScaling: 1.3 }),
    op(14, -12, env(0.002, 0, 0.15, -18, 0.8, -60, 0.2), { ...thinner(3), rateScaling: 1.42 }),
    op(1, -8, env(0.002, 0, 1, -10, 5, -44, 0.4), { detune: 3, rateScaling: 1.3 }),
    op(1, -16.5, env(0.002, 0, 0.8, -12, 2, -48, 0.3), { detune: -1, ...thinner(1.5), rateScaling: 1.3 }),
  ],
};

/** A tall stack, an octave down, with feedback: a plucked growl that thins as it rings. */
const BASS: Partial<ChapterPatch> = {
  algorithm: 1,
  dxFeedback: 2.2,
  dxOperators: [
    op(0.5, 0, env(0.003, 0, 0.3, -8, 1.5, -30, 0.15), { rateScaling: 1.2 }),
    op(0.5, -10, env(0.002, 0, 0.12, -14, 0.8, -40, 0.12), { ...thinner(1) }),
    op(1, -2, env(0.003, 0, 0.3, -8, 1.5, -30, 0.15)),
    op(1, -12, env(0.002, 0, 0.1, -16, 0.6, -50, 0.1)),
    op(1, -16, env(0.002, 0, 0.08, -20, 0.5, -60, 0.1)),
    op(3, -22, env(0.001, 0, 0.05, -30, 0.3, -72, 0.1)),
  ],
};

/** Pairs at ratios that are not whole numbers, left to ring a long time. */
const BELL: Partial<ChapterPatch> = {
  algorithm: 5,
  dxFeedback: 0,
  dxOperators: [
    op(1, 0, env(0.001, 0, 0.4, -8, 12, -96, 4)),
    op(3.5, -10, env(0.001, 0, 0.3, -14, 8, -96, 3)),
    op(2.76, -4, env(0.001, 0, 0.3, -10, 10, -96, 4), { detune: 3 }),
    op(1.4, -12, env(0.001, 0, 0.2, -16, 6, -96, 3)),
    op(5.4, -8, env(0.001, 0, 0.2, -12, 7, -96, 3), { detune: -3 }),
    op(1.41, -14, env(0.001, 0, 0.15, -18, 4, -96, 2)),
  ],
};

/** Short, woody strikes: a quick bright knock over a tone that dies away fast. */
const MARIMBA: Partial<ChapterPatch> = {
  algorithm: 7,
  dxFeedback: 0,
  dxOperators: [
    op(1, 0, env(0.001, 0, 0.12, -10, 1.6, -96, 0.3), { rateScaling: 1.25 }),
    op(4, -14, env(0.001, 0, 0.04, -24, 0.3, -96, 0.1), { rateScaling: 1.25, ...thinner(2) }),
    op(1, -4, env(0.001, 0, 0.1, -12, 1.3, -96, 0.3), { detune: 2, rateScaling: 1.25 }),
    op(3.5, -16, env(0.001, 0, 0.03, -30, 0.2, -96, 0.1), { rateScaling: 1.25 }),
    op(10, -26, env(0.001, 0, 0.015, -40, 0.08, -96, 0.05)),
    op(1, null),
  ],
};

/** Six carriers, no modulation (algorithm 32): drawbars on an organ. */
const ORGAN: Partial<ChapterPatch> = {
  algorithm: 32,
  dxFeedback: 0,
  dxOperators: [op(0.5, -1.9), op(1, 0), op(2, -3.1), op(3, -6), op(4, -8), op(6, -10.5)],
};

export const DX7_VOICES: Preset[] = [
  { label: 'Stacks', hint: 'algorithm 1, held', patch: DX7_STACKS },
  {
    label: 'E. piano',
    hint: "set by hand after the DX7's E. PIANO 1; an approximation",
    patch: PIANO,
  },
  { label: 'Bass', hint: "set by hand after the DX7's BASS 1; an approximation", patch: BASS },
  { label: 'Bell', hint: "set by hand after the DX7's TUB BELLS; an approximation", patch: BELL },
  {
    label: 'Marimba',
    hint: "set by hand after the DX7's MARIMBA; an approximation",
    patch: MARIMBA,
  },
  { label: 'Organ', hint: 'six carriers, algorithm 32', patch: ORGAN },
];
