// Runs on the audio thread, in an AudioWorklet. Vite bundles it on its own
// (see the `?worker&url` import in engine.ts), so it may import from
// src/dsp but must not touch the DOM.
import { FmKernel } from '../dsp/fmKernel';
import { PlateReverb, type ReverbMessage } from '../dsp/plateReverb';
import { MAX_OPERATORS, PmKernel, TWO_OPERATORS } from '../dsp/pmKernel';
import { type VoiceMessage, VoicePool, VOICES } from '../dsp/voicePool';
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
 * `mode` at 2 plays notes of six operators through one of the DX7's
 * algorithms, several at once (dsp/voicePool.ts), for Operators and
 * algorithms and the sandbox. Those notes are messages on the port, not
 * params: `patch`, `noteOn`, `noteOff` and `allOff` (VoiceMessage).
 *
 * Its first output is stereo: the sound in both channels, and in mode 2
 * the sandbox's plate reverb's wet added in each when it is on
 * (dsp/plateReverb.ts; a `reverb` message). Its second, mono, is the dry
 * sound alone, which the analyser measures: the spectrum is the notes,
 * never the tail.
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
    ].map(param => ({ ...param, automationRate: 'a-rate' }));
  }

  private readonly pm = new PmKernel(TWO_OPERATORS, LOCK_SECONDS * sampleRate);
  private readonly voices = new VoicePool(VOICES, sampleRate, LOCK_SECONDS * sampleRate);
  private readonly reverb = new PlateReverb(sampleRate);
  /** The dry sound of a block, before the reverb: grown only if a block is longer. */
  private dry = new Float32Array(128);
  /** The mode of the last block rendered. */
  private mode = 0;
  private readonly fm = new FmKernel();
  private wasFm = false;
  // Operator 0 is the carrier: the base frequency, at full level.
  private readonly ratios = new Float64Array(MAX_OPERATORS).fill(1);
  private readonly levels = new Float64Array(MAX_OPERATORS).fill(1);

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<VoiceMessage | ReverbMessage>) => {
      const message = event.data;
      if (message.type === 'reverb') {
        this.reverb.set(
          { seconds: message.seconds, tone: message.tone, mix: message.mix, preDelay: message.preDelay },
          message.on,
        );
        return;
      }
      // Outside mode 2 the voices are not rendered, so they could not fade:
      // there, all off is at once (the engine has faded the output anyway).
      if (message.type === 'allOff' && this.mode !== 2) this.voices.reset();
      else this.voices.handle(message);
    };
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const channels = outputs[0];
    const out = channels[0];
    // The second output: the dry sound alone, for the analyser.
    const dryOut = outputs[1]?.[0];
    const { frequency, ratio, index, modFrequency, deviation } = parameters;
    // A param that is not moving arrives as a single value.
    const at = (param: Float32Array, i: number) =>
      param.length > 1 ? param[i] : param[0];

    const mode = Math.round(parameters.mode[0]);
    this.mode = mode;
    if (mode === 2) {
      if (this.dry.length < out.length) this.dry = new Float32Array(out.length);
      const dry = this.dry.subarray(0, out.length);
      this.voices.render(dry);
      dryOut?.set(dry);
      // Both channels the dry, and the plate's wet when it runs.
      this.reverb.process(dry, out, channels[1] ?? out, out.length);
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
    dryOut?.set(out);
    return true;
  }
}

registerProcessor(PROCESSOR_NAME, SynthProcessor);
