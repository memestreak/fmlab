import type { Operator } from '../dsp/operators';
import type { ChapterPatch, Preset } from './types';

// Six-operator sounds to start from, shared by chapter 8's last step and
// the sandbox's six operators.

/** Six operators from a list of [ratio, level, decay]. */
export const ops = (...rows: [number, number, number][]): Operator[] =>
  rows.map(([ratio, level, decay]) => ({ ratio, level, decay }));

/**
 * Where the last step starts: algorithm 1, its two stacks held steady, the
 * short one (OP2 on OP1) and the tall one (OP6 on 5 on 4 on 3).
 */
export const STACKS: Partial<ChapterPatch> = {
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

export const DX7_PRESETS: Preset[] = [
  { label: 'Stacks', hint: 'algorithm 1, held', patch: STACKS },
  { label: 'E. piano', hint: 'three pairs, algorithm 5', patch: PIANO },
  { label: 'Bass', hint: 'a stack with feedback, algorithm 1', patch: BASS },
  { label: 'Bell', hint: 'pairs not in whole ratios, algorithm 5', patch: BELL },
  { label: 'Organ', hint: 'six carriers, algorithm 32', patch: ORGAN },
];
