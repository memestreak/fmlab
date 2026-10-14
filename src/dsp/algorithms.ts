import { type Algorithm, MAX_OPERATORS } from './pmKernel';

/**
 * One of the DX7's 32 algorithms, written as the DX7 numbers things: the
 * operators 1 to 6, and for each the operators that modulate it. The
 * carriers, the ones heard, sit along the bottom of the DX7's diagrams.
 * Every algorithm has a feedback loop, `[from, to]`: an operator feeding
 * itself, or in algorithms 4 and 6 a loop from lower in a stack back to
 * its top.
 *
 * Checked against the table in Dexed's msfa engine, a DX7 emulation
 * matched against the hardware, by src/__tests__/dsp/algorithms.test.ts.
 */
interface Dx7Algorithm {
  number: number;
  /** Operator number to the operators that modulate it. */
  modulators: Partial<Record<number, number[]>>;
  carriers: number[];
  feedback: [from: number, to: number];
}

const DX7: Dx7Algorithm[] = [
  { number: 1, carriers: [1, 3], modulators: { 1: [2], 3: [4], 4: [5], 5: [6] }, feedback: [6, 6] },
  { number: 2, carriers: [1, 3], modulators: { 1: [2], 3: [4], 4: [5], 5: [6] }, feedback: [2, 2] },
  { number: 3, carriers: [1, 4], modulators: { 1: [2], 2: [3], 4: [5], 5: [6] }, feedback: [6, 6] },
  { number: 4, carriers: [1, 4], modulators: { 1: [2], 2: [3], 4: [5], 5: [6] }, feedback: [4, 6] },
  { number: 5, carriers: [1, 3, 5], modulators: { 1: [2], 3: [4], 5: [6] }, feedback: [6, 6] },
  { number: 6, carriers: [1, 3, 5], modulators: { 1: [2], 3: [4], 5: [6] }, feedback: [5, 6] },
  { number: 7, carriers: [1, 3], modulators: { 1: [2], 3: [4, 5], 5: [6] }, feedback: [6, 6] },
  { number: 8, carriers: [1, 3], modulators: { 1: [2], 3: [4, 5], 5: [6] }, feedback: [4, 4] },
  { number: 9, carriers: [1, 3], modulators: { 1: [2], 3: [4, 5], 5: [6] }, feedback: [2, 2] },
  { number: 10, carriers: [1, 4], modulators: { 1: [2], 2: [3], 4: [5, 6] }, feedback: [3, 3] },
  { number: 11, carriers: [1, 4], modulators: { 1: [2], 2: [3], 4: [5, 6] }, feedback: [6, 6] },
  { number: 12, carriers: [1, 3], modulators: { 1: [2], 3: [4, 5, 6] }, feedback: [2, 2] },
  { number: 13, carriers: [1, 3], modulators: { 1: [2], 3: [4, 5, 6] }, feedback: [6, 6] },
  { number: 14, carriers: [1, 3], modulators: { 1: [2], 3: [4], 4: [5, 6] }, feedback: [6, 6] },
  { number: 15, carriers: [1, 3], modulators: { 1: [2], 3: [4], 4: [5, 6] }, feedback: [2, 2] },
  { number: 16, carriers: [1], modulators: { 1: [2, 3, 5], 3: [4], 5: [6] }, feedback: [6, 6] },
  { number: 17, carriers: [1], modulators: { 1: [2, 3, 5], 3: [4], 5: [6] }, feedback: [2, 2] },
  { number: 18, carriers: [1], modulators: { 1: [2, 3, 4], 4: [5], 5: [6] }, feedback: [3, 3] },
  { number: 19, carriers: [1, 4, 5], modulators: { 1: [2], 2: [3], 4: [6], 5: [6] }, feedback: [6, 6] },
  { number: 20, carriers: [1, 2, 4], modulators: { 1: [3], 2: [3], 4: [5, 6] }, feedback: [3, 3] },
  { number: 21, carriers: [1, 2, 4, 5], modulators: { 1: [3], 2: [3], 4: [6], 5: [6] }, feedback: [3, 3] },
  { number: 22, carriers: [1, 3, 4, 5], modulators: { 1: [2], 3: [6], 4: [6], 5: [6] }, feedback: [6, 6] },
  { number: 23, carriers: [1, 2, 4, 5], modulators: { 2: [3], 4: [6], 5: [6] }, feedback: [6, 6] },
  { number: 24, carriers: [1, 2, 3, 4, 5], modulators: { 3: [6], 4: [6], 5: [6] }, feedback: [6, 6] },
  { number: 25, carriers: [1, 2, 3, 4, 5], modulators: { 4: [6], 5: [6] }, feedback: [6, 6] },
  { number: 26, carriers: [1, 2, 4], modulators: { 2: [3], 4: [5, 6] }, feedback: [6, 6] },
  { number: 27, carriers: [1, 2, 4], modulators: { 2: [3], 4: [5, 6] }, feedback: [3, 3] },
  { number: 28, carriers: [1, 3, 6], modulators: { 1: [2], 3: [4], 4: [5] }, feedback: [5, 5] },
  { number: 29, carriers: [1, 2, 3, 5], modulators: { 3: [4], 5: [6] }, feedback: [6, 6] },
  { number: 30, carriers: [1, 2, 3, 6], modulators: { 3: [4], 4: [5] }, feedback: [5, 5] },
  { number: 31, carriers: [1, 2, 3, 4, 5], modulators: { 5: [6] }, feedback: [6, 6] },
  { number: 32, carriers: [1, 2, 3, 4, 5, 6], modulators: {}, feedback: [6, 6] },
];

/** The algorithms as the kernel takes them: operators numbered from 0. */
export const ALGORITHMS: readonly Algorithm[] = DX7.map(dx7 => ({
  modulators: Array.from({ length: MAX_OPERATORS }, (_, op) =>
    (dx7.modulators[op + 1] ?? []).map(from => from - 1),
  ),
  carriers: dx7.carriers.map(op => op - 1),
  feedback: { from: dx7.feedback[0] - 1, to: dx7.feedback[1] - 1 },
}));

export const ALGORITHM_COUNT = ALGORITHMS.length;

/** Algorithm `number`, 1 to 32 as the DX7 numbers them. */
export function algorithm(number: number): Algorithm {
  return ALGORITHMS[Math.min(ALGORITHM_COUNT, Math.max(1, Math.round(number))) - 1];
}

/** Which operators an algorithm modulates: each operator's targets. */
export function targetsOf(alg: Algorithm): number[][] {
  const targets: number[][] = Array.from({ length: MAX_OPERATORS }, () => []);
  alg.modulators.forEach((froms, to) => froms.forEach(from => targets[from].push(to)));
  return targets;
}
