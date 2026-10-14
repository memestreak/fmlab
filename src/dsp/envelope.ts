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
  /** Seconds from the start of the note until it is let go. */
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

/** The envelope's level, 0 to 1, `time` seconds into the note. */
export function envelopeAt(envelope: Envelope, time: number): number {
  const { attack, decay, sustain, release, hold } = envelope;
  if (time <= 0) return 0;

  // Up to `at`, with the note still held.
  const held = (at: number) => {
    if (at <= attack) return at / attack;
    const settling = Math.exp((-(at - attack) * TIME_CONSTANTS) / decay);
    return sustain + (1 - sustain) * settling;
  };
  if (time <= hold) return held(time);
  // Let go, from wherever it had got to.
  return held(hold) * Math.exp((-(time - hold) * TIME_CONSTANTS) / release);
}

/** How long the whole note is drawn and heard for: held, then released. */
export function noteSeconds({ hold, release }: Envelope): number {
  return hold + release;
}
