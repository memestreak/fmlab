// What an AudioWorklet module can see (AudioWorkletGlobalScope), which
// TypeScript's DOM library leaves out. Only pmProcessor.ts runs there.

/** The sample rate of the context the processor belongs to. */
declare const sampleRate: number;

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  /**
   * Fills one block (128 frames). `parameters` holds, per AudioParam,
   * either one value for the whole block or one per frame. Return true to
   * keep the processor alive.
   */
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processor: new () => AudioWorkletProcessor,
): void;
