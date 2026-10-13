const TWO_PI = 2 * Math.PI;

/**
 * True frequency modulation, a sample at a time: one modulator moving one
 * carrier's frequency. The rest of the lab is phase modulation (PmKernel);
 * this exists for the chapter where vibrato turns into timbre, which is
 * about frequency, and where the modulator has a rate in Hz of its own
 * rather than a ratio.
 *
 * Like PmKernel it has no Web Audio in it, so the tests can hold it to
 * trueFmSample. Unlike PmKernel it does not lock the two phases together:
 * once the modulator's rate has been moved the waves are wherever they
 * have got to. That only shows where sidebands coincide, at exact simple
 * ratios, which a modulator set in Hz on a log slider does not land on.
 */
export class FmKernel {
  /** Phases in cycles, 0 to 1. */
  private carrierPhase = 0;
  private modPhase = 0;

  /**
   * The next sample. All three are in cycles per sample.
   *
   * @param carrierFreq the carrier's resting frequency
   * @param modFreq the modulator's frequency
   * @param deviation how far the modulator pushes the carrier each way
   */
  tick(carrierFreq: number, modFreq: number, deviation: number): number {
    const sample = Math.sin(TWO_PI * this.carrierPhase);

    const frequency =
      carrierFreq + deviation * Math.sin(TWO_PI * this.modPhase);
    const carrierPhase = this.carrierPhase + frequency;
    this.carrierPhase = carrierPhase - Math.floor(carrierPhase);
    const modPhase = this.modPhase + modFreq;
    this.modPhase = modPhase - Math.floor(modPhase);

    return sample;
  }

  /** Back to the start of both waves, as the figures draw them. */
  reset(): void {
    this.carrierPhase = 0;
    this.modPhase = 0;
  }
}
