/** As many operators as a DX7 has. */
export const MAX_OPERATORS = 6;

const TWO_PI = 2 * Math.PI;

/**
 * How the operators are wired. Operators are numbered from 0, and a
 * modulator always has a higher number than the operator it modulates, so
 * one pass from the top down has every modulator's output ready when it is
 * needed.
 */
export interface Algorithm {
  /** For each operator, the operators that modulate its phase. */
  modulators: readonly (readonly number[])[];
  /** The operators that are heard. */
  carriers: readonly number[];
  /**
   * Feedback: the output of `from` added to the phase of `to`, a sample
   * late. Usually an operator feeding itself (`from` = `to`); in two DX7
   * algorithms a loop through a stack, from a lower operator back up to
   * the top one. How much is the `feedback` argument of `tick`.
   */
  feedback?: { from: number; to: number };
}

/** Simple FM: operator 1 modulates operator 0, the carrier. */
export const TWO_OPERATORS: Algorithm = {
  modulators: [[1], []],
  carriers: [0],
};

/**
 * Phase modulation, a sample at a time. It has no Web Audio in it: the
 * worklet runs it for sound, and the tests run it in node against the
 * waveform and spectrum formulas, so the three cannot drift apart.
 *
 * Every operator runs at a ratio of one base frequency, and its phase is
 * kept locked to `ratio * (cycles of the base so far)`. That is what the
 * formula sin(wc t + I sin(wm t)) assumes: both sines start together. The
 * lock matters when partials coincide (at ratio 1 the carrier's line is
 * J0 - J2 only in that phase), and a ratio that moves and comes back would
 * otherwise leave the modulator wherever it had drifted to. While a ratio
 * is moving its operator runs free; once it settles the phase is eased back
 * over about `lockSamples` samples, a detune too small and slow to hear.
 */
export class PmKernel {
  /** Cycles of the base frequency since the start, not wrapped. */
  private baseCycles = 0;
  /** Each operator's phase in cycles, 0 to 1. */
  private readonly phases = new Float64Array(MAX_OPERATORS);
  private readonly lastRatios = new Float64Array(MAX_OPERATORS).fill(NaN);
  private readonly outputs = new Float64Array(MAX_OPERATORS);
  private readonly pull: number;
  /** The feedback source's last two outputs: feedback uses their mean. */
  private fbLast = 0;
  private fbBefore = 0;

  constructor(
    private algorithm: Algorithm,
    lockSamples: number,
  ) {
    this.pull = 1 / Math.max(1, lockSamples);
  }

  /** Back to how it was made: every operator's phase at 0, for a new note. */
  reset(): void {
    this.baseCycles = 0;
    this.phases.fill(0);
    this.lastRatios.fill(NaN);
    this.outputs.fill(0);
    this.fbLast = 0;
    this.fbBefore = 0;
  }

  /** Rewires the operators, between notes; their phases carry on. */
  setAlgorithm(algorithm: Algorithm): void {
    this.algorithm = algorithm;
    this.fbLast = 0;
    this.fbBefore = 0;
  }

  /**
   * The next sample.
   *
   * @param baseFreq the base frequency, in cycles per sample
   * @param ratios each operator's frequency as a multiple of the base
   * @param levels each operator's output amplitude; for a modulator this
   *   is the modulation index, in radians
   * @param feedback how much of the feedback source's output is added to
   *   its target's phase, in radians at full output. The mean of its last
   *   two samples is used, as the DX7 does: one sample alone sets up a
   *   buzz at half the sample rate once feedback is strong.
   */
  tick(
    baseFreq: number,
    ratios: ArrayLike<number>,
    levels: ArrayLike<number>,
    feedback = 0,
  ): number {
    const { modulators, carriers, feedback: loop } = this.algorithm;
    const { phases, lastRatios, outputs } = this;
    const fed = loop && feedback !== 0 ? feedback * 0.5 * (this.fbLast + this.fbBefore) : 0;

    for (let op = modulators.length - 1; op >= 0; op--) {
      let modulation = loop && op === loop.to ? fed : 0;
      for (const from of modulators[op]) modulation += outputs[from];
      outputs[op] = levels[op] * Math.sin(TWO_PI * phases[op] + modulation);

      const ratio = ratios[op];
      let phase = phases[op] + baseFreq * ratio;
      if (ratio === lastRatios[op]) {
        const error = ratio * this.baseCycles - phases[op];
        // The nearest way round: an error of 0.9 cycles is -0.1.
        phase += this.pull * (error - Math.round(error));
      }
      phases[op] = phase - Math.floor(phase);
      lastRatios[op] = ratio;
    }
    this.baseCycles += baseFreq;
    if (loop) {
      this.fbBefore = this.fbLast;
      this.fbLast = outputs[loop.from];
    }

    let sample = 0;
    for (const op of carriers) sample += outputs[op];
    return sample;
  }
}
