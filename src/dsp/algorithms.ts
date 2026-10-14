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
  feedback?: [from: number, to: number];
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

/** How many algorithms the DX7 has. */
export const DX7_COUNT = DX7.length;

/**
 * The wirings chapter 8 builds up through before it reaches the DX7's: a
 * few operators each, the rest left out. They are not the DX7's, so they
 * are numbered after its 32, which lets `algorithm` in the state, the
 * worklet's param and the predicted spectrum take either kind alike.
 */
export const STEP_WIRINGS = {
  /** OP2 modulates OP1: the two operators of chapters 3 to 7. */
  pair: 33,
  /** Two pairs side by side, both heard. */
  twoPairs: 34,
  /** OP3 modulates OP2, which modulates OP1. */
  stack: 35,
  /** OP2 and OP3 both modulate OP1. */
  twoModulators: 36,
  /** One pair, OP2 fed its own output. */
  feedback: 37,
} as const;

const STEPS: Dx7Algorithm[] = [
  { number: STEP_WIRINGS.pair, carriers: [1], modulators: { 1: [2] } },
  { number: STEP_WIRINGS.twoPairs, carriers: [1, 3], modulators: { 1: [2], 3: [4] } },
  { number: STEP_WIRINGS.stack, carriers: [1], modulators: { 1: [2], 2: [3] } },
  { number: STEP_WIRINGS.twoModulators, carriers: [1], modulators: { 1: [2, 3] } },
  { number: STEP_WIRINGS.feedback, carriers: [1], modulators: { 1: [2] }, feedback: [2, 2] },
];

/** The algorithms as the kernel takes them: operators numbered from 0. */
export const ALGORITHMS: readonly Algorithm[] = [...DX7, ...STEPS].map(dx7 => ({
  modulators: Array.from({ length: MAX_OPERATORS }, (_, op) =>
    (dx7.modulators[op + 1] ?? []).map(from => from - 1),
  ),
  carriers: dx7.carriers.map(op => op - 1),
  ...(dx7.feedback
    ? { feedback: { from: dx7.feedback[0] - 1, to: dx7.feedback[1] - 1 } }
    : {}),
}));

export const ALGORITHM_COUNT = ALGORITHMS.length;

/** Just the DX7's 32. */
export const DX7_ALGORITHMS = ALGORITHMS.slice(0, DX7_COUNT);

/**
 * Algorithm `number`: 1 to 32 as the DX7 numbers them, and after them the
 * step wirings.
 */
export function algorithm(number: number): Algorithm {
  return ALGORITHMS[Math.min(ALGORITHM_COUNT, Math.max(1, Math.round(number))) - 1];
}

/** Whether `number` is one of the DX7's 32, not a step wiring. */
export function isDx7(number: number): boolean {
  return number >= 1 && number <= DX7_COUNT;
}

/**
 * The operators an algorithm uses: every carrier and every modulator.
 * All six for the DX7's; fewer for a step wiring.
 */
export function operatorsUsed(alg: Algorithm): number[] {
  const used = new Set<number>(alg.carriers);
  alg.modulators.forEach((froms, to) => {
    if (froms.length > 0) used.add(to);
    froms.forEach(from => used.add(from));
  });
  return [...used].sort((a, b) => a - b);
}

/**
 * The DX7's 32 grouped by how many carriers each has, fewest first: the
 * picker's groups. A carrier is heard, so this is roughly how many
 * separate voices an algorithm adds together.
 */
export function algorithmsByCarriers(): { carriers: number; numbers: number[] }[] {
  const groups = new Map<number, number[]>();
  for (let number = 1; number <= DX7_COUNT; number++) {
    const count = algorithm(number).carriers.length;
    groups.set(count, [...(groups.get(count) ?? []), number]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([carriers, numbers]) => ({ carriers, numbers }));
}

/** Which operators an algorithm modulates: each operator's targets. */
export function targetsOf(alg: Algorithm): number[][] {
  const targets: number[][] = Array.from({ length: MAX_OPERATORS }, () => []);
  alg.modulators.forEach((froms, to) => froms.forEach(from => targets[from].push(to)));
  return targets;
}
