// Runs on the audio thread, in an AudioWorklet. Vite bundles it on its own
// (see the `?worker&url` import in engine.ts), so it may import from
// src/dsp but must not touch the DOM.
import { algorithm, ALGORITHM_COUNT } from '../dsp/algorithms';
import { FmKernel } from '../dsp/fmKernel';
import { kernelLevels } from '../dsp/operators';
import { MAX_OPERATORS, PmKernel, TWO_OPERATORS } from '../dsp/pmKernel';
import { PROCESSOR_NAME } from './processorName';

/** How long a settled ratio takes to pull its operator back into phase. */
const LOCK_SECONDS = 0.05;

/**
 * The synth. It is a phase-modulation engine: the kernel can run six
 * operators through any algorithm; for now it is wired as two, and
 * `frequency` (Hz), `ratio` and `index` (radians) are spread over them
 * here. More operators means more params and another algorithm, not
 * another processor.
 *
 * `mode` at 2 runs all six operators through one of the DX7's
 * algorithms, for chapter 8 (see processSix).
 *
 * `mode` at 1 switches to true FM instead, for the vibrato chapter:
 * `modFrequency` and `deviation`, both in Hz, move the carrier's
 * frequency. The engine only flips `mode` while the output is faded out.
 */
class SynthProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 1, maxValue: 20000 },
      { name: 'ratio', defaultValue: 1, minValue: 0, maxValue: 64 },
      { name: 'index', defaultValue: 0, minValue: 0, maxValue: 64 },
      { name: 'modFrequency', defaultValue: 5, minValue: 0, maxValue: 20000 },
      { name: 'deviation', defaultValue: 0, minValue: 0, maxValue: 20000 },
      { name: 'mode', defaultValue: 0, minValue: 0, maxValue: 2 },
      // Six operators, mode 2: each one's ratio and level, the algorithm
      // (1 to 32) and its feedback.
      ...[1, 2, 3, 4, 5, 6].flatMap(op => [
        { name: `ratio${op}`, defaultValue: 1, minValue: 0, maxValue: 64 },
        { name: `level${op}`, defaultValue: 0, minValue: 0, maxValue: 1 },
      ]),
      { name: 'algorithm', defaultValue: 1, minValue: 1, maxValue: ALGORITHM_COUNT },
      { name: 'feedback', defaultValue: 0, minValue: 0, maxValue: 8 },
    ].map(param => ({ ...param, automationRate: 'a-rate' }));
  }

  private readonly pm = new PmKernel(TWO_OPERATORS, LOCK_SECONDS * sampleRate);
  private readonly six = new PmKernel(algorithm(1), LOCK_SECONDS * sampleRate);
  private sixAlgorithm = 1;
  private readonly sixRatios = new Float64Array(MAX_OPERATORS);
  private readonly sixLevels = new Float64Array(MAX_OPERATORS);
  private readonly sixScaled = new Float64Array(MAX_OPERATORS);
  private readonly fm = new FmKernel();
  private wasFm = false;
  // Operator 0 is the carrier: the base frequency, at full level.
  private readonly ratios = new Float64Array(MAX_OPERATORS).fill(1);
  private readonly levels = new Float64Array(MAX_OPERATORS).fill(1);

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const channels = outputs[0];
    const out = channels[0];
    const { frequency, ratio, index, modFrequency, deviation } = parameters;
    // A param that is not moving arrives as a single value.
    const at = (param: Float32Array, i: number) =>
      param.length > 1 ? param[i] : param[0];

    const mode = Math.round(parameters.mode[0]);
    if (mode === 2) {
      this.processSix(out, parameters);
      for (let c = 1; c < channels.length; c++) channels[c].set(out);
      return true;
    }
    const isFm = mode === 1;
    // Each visit to true FM starts both waves together, as drawn.
    if (isFm && !this.wasFm) this.fm.reset();
    this.wasFm = isFm;

    if (isFm) {
      for (let i = 0; i < out.length; i++) {
        out[i] = this.fm.tick(
          at(frequency, i) / sampleRate,
          at(modFrequency, i) / sampleRate,
          at(deviation, i) / sampleRate,
        );
      }
    } else {
      const { pm, ratios, levels } = this;
      for (let i = 0; i < out.length; i++) {
        ratios[1] = at(ratio, i);
        levels[1] = at(index, i);
        out[i] = pm.tick(at(frequency, i) / sampleRate, ratios, levels);
      }
    }
    for (let c = 1; c < channels.length; c++) channels[c].set(out);
    return true;
  }

  /**
   * Six operators through one of the 32 algorithms. The levels are scaled
   * as the predicted spectrum scales them (`kernelLevels`): a modulator's
   * into its index, the carriers' shared out so every algorithm is about
   * as loud.
   */
  private processSix(out: Float32Array, parameters: Record<string, Float32Array>): void {
    const at = (param: Float32Array, i: number) =>
      param.length > 1 ? param[i] : param[0];
    const number = Math.round(parameters.algorithm[0]);
    if (number !== this.sixAlgorithm) {
      this.sixAlgorithm = number;
      this.six.setAlgorithm(algorithm(number));
    }
    const alg = algorithm(number);
    const { frequency, feedback } = parameters;
    const { sixRatios, sixLevels, sixScaled } = this;
    for (let i = 0; i < out.length; i++) {
      for (let op = 0; op < MAX_OPERATORS; op++) {
        sixRatios[op] = at(parameters[`ratio${op + 1}`], i);
        sixLevels[op] = at(parameters[`level${op + 1}`], i);
      }
      out[i] = this.six.tick(
        at(frequency, i) / sampleRate,
        sixRatios,
        kernelLevels(alg, sixLevels, sixScaled),
        at(feedback, i),
      );
    }
  }
}

registerProcessor(PROCESSOR_NAME, SynthProcessor);
