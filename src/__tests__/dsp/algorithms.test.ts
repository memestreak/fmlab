import { algorithm, ALGORITHMS, targetsOf } from '../../dsp/algorithms';

/*
 * The reference: the algorithm table of the msfa engine in Dexed, a DX7
 * emulator (github.com/asb2m10/dexed, source/msfa/fm_core.cc, Apache
 * License 2.0), copied here as it is. Each row is one algorithm, its six
 * entries the operators in the order the engine runs them, OP6 first down
 * to OP1. Each entry's bits say where the operator reads its modulation
 * from and where it writes its output:
 *
 *   bits 0-1  output bus: 0 the sound itself (a carrier), or bus 1 or 2
 *   bit  2    add to that bus, rather than replace what is on it
 *   bits 4-5  input bus: none, 1 or 2
 *   bit  6    feedback in: this operator takes the feedback
 *   bit  7    feedback out: this operator's output is fed back (the last
 *             one marked, in running order, is the one that counts)
 */
const DEXED = [
  [0xc1, 0x11, 0x11, 0x14, 0x01, 0x14],
  [0x01, 0x11, 0x11, 0x14, 0xc1, 0x14],
  [0xc1, 0x11, 0x14, 0x01, 0x11, 0x14],
  [0xc1, 0x11, 0x94, 0x01, 0x11, 0x14],
  [0xc1, 0x14, 0x01, 0x14, 0x01, 0x14],
  [0xc1, 0x94, 0x01, 0x14, 0x01, 0x14],
  [0xc1, 0x11, 0x05, 0x14, 0x01, 0x14],
  [0x01, 0x11, 0xc5, 0x14, 0x01, 0x14],
  [0x01, 0x11, 0x05, 0x14, 0xc1, 0x14],
  [0x01, 0x05, 0x14, 0xc1, 0x11, 0x14],
  [0xc1, 0x05, 0x14, 0x01, 0x11, 0x14],
  [0x01, 0x05, 0x05, 0x14, 0xc1, 0x14],
  [0xc1, 0x05, 0x05, 0x14, 0x01, 0x14],
  [0xc1, 0x05, 0x11, 0x14, 0x01, 0x14],
  [0x01, 0x05, 0x11, 0x14, 0xc1, 0x14],
  [0xc1, 0x11, 0x02, 0x25, 0x05, 0x14],
  [0x01, 0x11, 0x02, 0x25, 0xc5, 0x14],
  [0x01, 0x11, 0x11, 0xc5, 0x05, 0x14],
  [0xc1, 0x14, 0x14, 0x01, 0x11, 0x14],
  [0x01, 0x05, 0x14, 0xc1, 0x14, 0x14],
  [0x01, 0x14, 0x14, 0xc1, 0x14, 0x14],
  [0xc1, 0x14, 0x14, 0x14, 0x01, 0x14],
  [0xc1, 0x14, 0x14, 0x01, 0x14, 0x04],
  [0xc1, 0x14, 0x14, 0x14, 0x04, 0x04],
  [0xc1, 0x14, 0x14, 0x04, 0x04, 0x04],
  [0xc1, 0x05, 0x14, 0x01, 0x14, 0x04],
  [0x01, 0x05, 0x14, 0xc1, 0x14, 0x04],
  [0x04, 0xc1, 0x11, 0x14, 0x01, 0x14],
  [0xc1, 0x14, 0x01, 0x14, 0x04, 0x04],
  [0x04, 0xc1, 0x11, 0x14, 0x04, 0x04],
  [0xc1, 0x14, 0x04, 0x04, 0x04, 0x04],
  [0xc4, 0x04, 0x04, 0x04, 0x04, 0x04],
];

/**
 * Runs one row of the reference the way the engine does, keeping track of
 * which operators are on each bus, and says what it amounts to: each
 * operator's modulators, the carriers and the feedback loop, all with
 * operators numbered from 0 as the kernel numbers them.
 */
function decode(row: number[]) {
  const buses: Record<number, number[]> = { 1: [], 2: [] };
  const modulators: number[][] = [[], [], [], [], [], []];
  const carriers: number[] = [];
  let from = -1;
  let to = -1;
  row.forEach((flags, i) => {
    const op = 5 - i;
    const input = (flags >> 4) & 3;
    if (input) modulators[op] = [...buses[input]].sort();
    const output = flags & 3;
    if (output === 0) carriers.push(op);
    else if (flags & 4) buses[output].push(op);
    else buses[output] = [op];
    if (flags & 0x40) to = op;
    if (flags & 0x80) from = op;
  });
  return { modulators, carriers: carriers.sort(), feedback: { from, to } };
}

describe('the 32 algorithms', () => {
  it('are 32', () => {
    expect(ALGORITHMS).toHaveLength(32);
  });

  it.each(DEXED.map((row, i) => [i + 1, row] as const))(
    'algorithm %i matches the reference',
    (number, row) => {
      const ours = algorithm(number);
      const theirs = decode([...row]);
      expect(ours.modulators.map(list => [...list].sort())).toEqual(theirs.modulators);
      expect([...ours.carriers].sort()).toEqual(theirs.carriers);
      expect(ours.feedback).toEqual(theirs.feedback);
    },
  );

  it.each(ALGORITHMS.map((alg, i) => [i + 1, alg] as const))(
    'algorithm %i can be run in one pass from OP6 down',
    (_, alg) => {
      alg.modulators.forEach((froms, to) => {
        for (const from of froms) expect(from).toBeGreaterThan(to);
      });
    },
  );

  it.each(ALGORITHMS.map((alg, i) => [i + 1, alg] as const))(
    'algorithm %i uses every operator: heard, or modulating one that is',
    (_, alg) => {
      const targets = targetsOf(alg);
      for (let op = 0; op < 6; op++) {
        expect(alg.carriers.includes(op) || targets[op].length > 0).toBe(true);
      }
    },
  );

  it('has the shapes everyone knows', () => {
    // 1: two stacks, OP2 on OP1 and OP6 > 5 > 4 > 3, feedback on OP6.
    expect(algorithm(1).carriers).toEqual([0, 2]);
    // 5: three pairs. 32: six carriers, an organ.
    expect(algorithm(5).carriers).toEqual([0, 2, 4]);
    expect(algorithm(32).carriers).toEqual([0, 1, 2, 3, 4, 5]);
    // 4 and 6: the two loops through a stack.
    expect(algorithm(4).feedback).toEqual({ from: 3, to: 5 });
    expect(algorithm(6).feedback).toEqual({ from: 4, to: 5 });
    // 22: OP6 modulates three carriers at once.
    expect(targetsOf(algorithm(22))[5]).toEqual([2, 3, 4]);
  });

  it('are numbered 1 to 32, and hold anything else to the ends', () => {
    expect(algorithm(1)).toBe(ALGORITHMS[0]);
    expect(algorithm(32)).toBe(ALGORITHMS[31]);
    expect(algorithm(0)).toBe(ALGORITHMS[0]);
    expect(algorithm(40)).toBe(ALGORITHMS[31]);
  });
});
