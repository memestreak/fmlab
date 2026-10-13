// Runs on the audio thread, in an AudioWorklet. Vite bundles it on its own
// (see the `?worker&url` import in engine.ts), so it may import from
// src/dsp but must not touch the DOM.
import { MAX_OPERATORS, PmKernel, TWO_OPERATORS } from '../dsp/pmKernel';
import { PROCESSOR_NAME } from './processorName';

/** How long a settled ratio takes to pull its operator back into phase. */
const LOCK_SECONDS = 0.05;

/**
 * The phase-modulation engine. The kernel can run six operators through
 * any algorithm; for now it is wired as two, and the three AudioParams
 * (`frequency` in Hz, `ratio`, `index` in radians) are spread over them
 * here. More operators means more params and another algorithm, not
 * another processor.
 */
class PmProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 1, maxValue: 20000 },
      { name: 'ratio', defaultValue: 1, minValue: 0, maxValue: 64 },
      { name: 'index', defaultValue: 0, minValue: 0, maxValue: 64 },
    ].map(param => ({ ...param, automationRate: 'a-rate' }));
  }

  private readonly kernel = new PmKernel(
    TWO_OPERATORS,
    LOCK_SECONDS * sampleRate,
  );
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
    const { frequency, ratio, index } = parameters;
    const { kernel, ratios, levels } = this;

    for (let i = 0; i < out.length; i++) {
      // A param that is not moving arrives as a single value.
      const hz = frequency.length > 1 ? frequency[i] : frequency[0];
      ratios[1] = ratio.length > 1 ? ratio[i] : ratio[0];
      levels[1] = index.length > 1 ? index[i] : index[0];
      out[i] = kernel.tick(hz / sampleRate, ratios, levels);
    }
    for (let c = 1; c < channels.length; c++) channels[c].set(out);
    return true;
  }
}

registerProcessor(PROCESSOR_NAME, PmProcessor);
