/**
 * The shape of one note over time: attack, decay, sustain, release, and
 * how long the note is held before it is let go.
 */
export interface Envelope {
  /** Seconds to rise from 0 to 1, in a straight line. */
  attack: number;
  /** Seconds to settle from 1 to the sustain level. */
  decay: number;
  /** The level held until the note is let go, 0 to 1. */
  sustain: number;
  /** Seconds to die away once the note is let go. */
  release: number;
  /**
   * Seconds from the start of the note until it is let go. Infinity for a
   * note still held, whose end is not known yet: when it is let go, the
   * same envelope with `hold` set to that moment releases from wherever
   * the curve had got to, so the level carries on without a jump.
   */
  hold: number;
}

/**
 * The decay and the release are not straight lines but die away as a
 * struck or blown thing does, quickly at first and then ever more slowly
 * (an exponential). Such a curve never quite arrives, so its time is taken
 * as four time constants, by when it is within 2% of where it is going.
 * Web Audio's setTargetAtTime draws the same curve, which lets the engine
 * play exactly what this module describes.
 */
export const TIME_CONSTANTS = 4;

/**
 * The envelope's level, 0 to 1, `time` seconds into the note. The audio
 * thread calls this for every operator of every voice at every sample, so
 * it makes nothing new.
 */
export function envelopeAt(envelope: Envelope, time: number): number {
  if (time <= 0) return 0;
  if (time <= envelope.hold) return heldAt(envelope, time);
  // Let go, from wherever it had got to.
  return (
    heldAt(envelope, envelope.hold) *
    Math.exp((-(time - envelope.hold) * TIME_CONSTANTS) / envelope.release)
  );
}

/** The level `at` seconds in, with the note still held. */
function heldAt({ attack, decay, sustain }: Envelope, at: number): number {
  if (at <= attack) return at / attack;
  // Held at full: nothing to settle (and no exp to work out).
  if (sustain === 1) return 1;
  const settling = Math.exp((-(at - attack) * TIME_CONSTANTS) / decay);
  return sustain + (1 - sustain) * settling;
}

/** How long the whole note is drawn and heard for: held, then released. */
export function noteSeconds({ hold, release }: Envelope): number {
  return hold + release;
}
