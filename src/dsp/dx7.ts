// The sandbox's voice: six operators as a DX7 describes them, in clean
// units. Each operator has a ratio, a detune in cents, a level in dB, a
// four-part envelope (times in seconds, levels in dB) and keyboard
// scaling. The numbers follow msfa, the DX7 engine in Dexed
// (github.com/asb2m10/dexed, source/msfa): dx7note.cc and env.cc.
// Operators and algorithms keeps its simpler operator (operators.ts).

import { algorithm } from './algorithms';
import { type Algorithm, MAX_OPERATORS } from './pmKernel';

/** A level at or below this is silence: the envelope's floor. */
export const SILENCE_DB = -96;
/** An operator's level, and its envelope's levels: 0 dB is full. */
export const LEVEL_DB = { min: -72, max: 0 };
/**
 * A modulator at full level swings the phase it modulates by two cycles
 * each way, as msfa's does: its index is 4π, about 12.6 radians.
 */
export const FULL_INDEX = 4 * Math.PI;
/** A ratio: msfa's coarse 0 (a half) to 31, times 1 + fine / 100. */
export const DX7_RATIO = { min: 0.5, max: 61.69 };
/** Detune in cents: msfa's -7 to +7, each step 12606 / 2^24 octave, about 0.9 cent. */
const DETUNE_STEP = (12606 / 2 ** 24) * 1200;
export const DETUNE_CENTS = { min: -7 * DETUNE_STEP, max: 7 * DETUNE_STEP };
/** How much faster the envelope runs an octave up: msfa's 0 to 7. */
export const RATE_SCALING = { min: 1, max: 2 ** (7 / 8) };
/**
 * Keyboard level scaling's depth, in dB per three semitones on the linear
 * curve: msfa's depth 0 to 99, (group × depth × 329) >> 12 output-level
 * steps of 0.75 dB.
 */
export const SCALING_DEPTH = { min: -((99 * 329) / 4096) * 0.75, max: ((99 * 329) / 4096) * 0.75 };
/** Feedback in radians, on the source's own output: msfa's 7 is 2π. */
export const DX7_FEEDBACK = { min: 0, max: 2 * Math.PI };
/** The shortest a stage may be: shorter, and a note would start with a click. */
export const MIN_STAGE_SECONDS = 0.001;
/** The longest a stage may be. */
export const MAX_STAGE_SECONDS = 40;

/**
 * An operator's envelope. On a key, it rises from silence to `peak` over
 * `attack`, falls (or rises) to `brk` over `decay1`, then to `sustain`
 * over `decay2`, and holds there while the key is down; let go, it falls
 * to silence at the speed `release` sets, from wherever it is. Levels in
 * dB under the operator's level (0 is the operator's level); times in
 * seconds. The DX7's L1, L2, L3 are peak, brk and sustain; R1 to R4 are
 * attack, decay1, decay2 and release; L4, where it ends, is silence.
 */
export interface Dx7Envelope {
  attack: number;
  peak: number;
  decay1: number;
  /** The break: where the first decay ends and the second starts. */
  brk: number;
  decay2: number;
  sustain: number;
  /** Seconds to fall from full level to silence; less from lower. */
  release: number;
}

/** Linear (an even slope) or exponential (gentle, then steep). */
export type ScalingCurve = 'lin' | 'exp';

/** One side of keyboard level scaling. */
export interface ScalingSide {
  curve: ScalingCurve;
  /**
   * dB per three semitones from the break point on the linear curve; the
   * exponential curve reaches the same depth further out. Positive is
   * louder, negative quieter.
   */
  depth: number;
}

/** One of the sandbox's six operators. */
export interface Dx7Operator {
  ratio: number;
  /** Cents, sharp or flat. */
  detune: number;
  /** dB under full, or null for off. */
  level: number | null;
  envelope: Dx7Envelope;
  /** The key (MIDI number) where level scaling starts. */
  breakKey: number;
  /** Keys below the break point. */
  left: ScalingSide;
  /** Keys from the break point up. */
  right: ScalingSide;
  /** How much faster the envelope runs per octave up, ×1 to ×1.83. */
  rateScaling: number;
}

/** A level in dB as an amplitude, 0 to 1; silence is 0. */
export function dbToAmp(db: number): number {
  return db <= SILENCE_DB ? 0 : 10 ** (db / 20);
}

/** An amplitude as a level in dB, silence for nothing. */
export function ampToDb(amp: number): number {
  return amp <= 0 ? SILENCE_DB : Math.max(SILENCE_DB, 20 * Math.log10(amp));
}

/** A modulator at `db` modulates by this many radians: 4π at 0 dB. */
export function dbToIndex(db: number): number {
  return FULL_INDEX * dbToAmp(db);
}

/** A ratio detuned by `cents`. */
export function detuned(ratio: number, cents: number): number {
  return ratio * 2 ** (cents / 1200);
}

/** The level the envelope holds `at` seconds in while the key is down, 0 to 1. */
function heldAmp(env: Dx7Envelope, at: number): number {
  const attack = Math.max(MIN_STAGE_SECONDS, env.attack);
  // The attack is a straight line in amplitude, as fmlab's have always
  // been; msfa's rises fast and then slowly in dB. A known approximation.
  if (at < attack) return (at / attack) * dbToAmp(env.peak);
  let t = at - attack;
  if (t < env.decay1) return dbToAmp(env.peak + ((env.brk - env.peak) * t) / env.decay1);
  t -= env.decay1;
  if (t < env.decay2) return dbToAmp(env.brk + ((env.sustain - env.brk) * t) / env.decay2);
  return dbToAmp(env.sustain);
}

/**
 * The envelope's level, 0 to 1, `time` seconds into a note let go at
 * `hold` (Infinity while the key is down). The decays and the release are
 * straight lines in dB; the release falls from wherever the envelope had
 * got to, at the speed that takes it from full level to silence in
 * `release` seconds. The audio thread calls this for every operator of
 * every voice at every sample, so it makes nothing new.
 */
export function dx7EnvelopeAt(env: Dx7Envelope, time: number, hold = Infinity): number {
  if (time <= 0) return 0;
  if (time <= hold) return heldAmp(env, time);
  const from = ampToDb(heldAmp(env, hold));
  const speed = -SILENCE_DB / Math.max(MIN_STAGE_SECONDS, env.release);
  return dbToAmp(from - (time - hold) * speed);
}

/** When each part of a held envelope ends, in seconds from the key. */
export function stageEnds(env: Dx7Envelope): { attack: number; decay1: number; decay2: number } {
  const attack = Math.max(MIN_STAGE_SECONDS, env.attack);
  return { attack, decay1: attack + env.decay1, decay2: attack + env.decay1 + env.decay2 };
}

/**
 * How long a released envelope takes to fall from `fromDb` to silence:
 * the release time for a fall from full level, less from lower.
 */
export function releaseSeconds(env: Dx7Envelope, fromDb = 0): number {
  return (Math.max(MIN_STAGE_SECONDS, env.release) * (fromDb - SILENCE_DB)) / -SILENCE_DB;
}

/** msfa's level-scaling curve, the exponential one, by group of three keys. */
const EXP_SCALE = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 14, 16, 19, 23, 27, 33, 39, 47, 56, 66, 80, 94, 110, 126,
  142, 158, 174, 190, 206, 222, 238, 250,
];

/**
 * How much keyboard level scaling adds to an operator's level at `key`,
 * in dB: nothing at the break point, growing a group of three keys at a
 * time away from it on each side (msfa's ScaleLevel and ScaleCurve,
 * without their rounding to whole steps).
 */
export function levelScalingDb(op: Pick<Dx7Operator, 'breakKey' | 'left' | 'right'>, key: number): number {
  const offset = Math.round(key) - Math.round(op.breakKey);
  const right = offset >= 0;
  const group = right ? Math.floor((offset + 1) / 3) : Math.floor((1 - offset) / 3);
  const side = right ? op.right : op.left;
  const shape = side.curve === 'lin' ? group : EXP_SCALE[Math.min(group, EXP_SCALE.length - 1)] / 8;
  return side.depth * shape;
}

/**
 * How many times faster an operator's envelope runs at `key` than at the
 * bottom of the keyboard: msfa's ScaleRate, which adds sensitivity × x / 8
 * to a rate whose speed doubles every four, x being a group of three keys
 * from A0 (up to 31). `perOctave` is the speed-up an octave up gives.
 */
export function rateScalingFactor(perOctave: number, key: number): number {
  const x = Math.min(31, Math.max(0, Math.floor(key / 3) - 7));
  // perOctave = 2^(s/8), and a factor of 2^(s x / 32).
  return perOctave ** (x / 4);
}

/** An envelope whose every stage runs `factor` times faster. */
export function fasterEnvelope(env: Dx7Envelope, factor: number): Dx7Envelope {
  return {
    ...env,
    attack: env.attack / factor,
    decay1: env.decay1 / factor,
    decay2: env.decay2 / factor,
    release: env.release / factor,
  };
}

/** The speed, in dB a second, of a DX7 rate (0 to 99), with rate scaling q added. */
export function dx7RateSpeed(rate: number, scalingQ = 0): number {
  const q = Math.min(63, Math.floor((rate * 41) / 64) + scalingQ);
  return 0.0633 * (4 + (q % 4)) * 2 ** Math.floor(q / 4);
}

/**
 * An operator's total level at `key`, in dB: its level and its keyboard
 * scaling, never above full (msfa holds the total at 127); null for an
 * operator that is off.
 */
export function levelAtKey(op: Dx7Operator, key: number): number | null {
  if (op.level === null) return null;
  return Math.min(0, op.level + levelScalingDb(op, key));
}

/** A frequency as the key it is nearest, as a MIDI number (A4 is 69). */
export function keyOf(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** What a note of six operators needs, worked out once when it is struck. */
export interface Dx7Note {
  alg: Algorithm;
  /** Each operator's ratio, detuned. */
  ratios: Float64Array;
  /**
   * Each operator's level as the kernel takes it, at the envelope's full
   * height: a modulator's index (4π at 0 dB), a carrier's share of the
   * output (all of them together make full scale).
   */
  gains: Float64Array;
  /** Each operator's envelope, run faster for the key as rate scaling says. */
  envelopes: Dx7Envelope[];
  /** Feedback as the kernel takes it: on the source's kernel output. */
  feedback: number;
}

/** A note of `operators` at `key`, through algorithm `number`. */
export function dx7Note(
  number: number,
  operators: readonly Dx7Operator[],
  feedback: number,
  key: number,
): Dx7Note {
  const alg = algorithm(number);
  const ratios = new Float64Array(MAX_OPERATORS);
  const gains = new Float64Array(MAX_OPERATORS);
  const envelopes: Dx7Envelope[] = [];
  const unit = (op: number) =>
    alg.carriers.includes(op) ? 1 / alg.carriers.length : FULL_INDEX;
  for (let op = 0; op < MAX_OPERATORS; op++) {
    const o = operators[op];
    if (!o) {
      ratios[op] = 1;
      envelopes.push(SILENT_ENVELOPE);
      continue;
    }
    ratios[op] = detuned(o.ratio, o.detune);
    const db = levelAtKey(o, key);
    gains[op] = db === null ? 0 : unit(op) * dbToAmp(db);
    envelopes.push(fasterEnvelope(o.envelope, rateScalingFactor(o.rateScaling, key)));
  }
  // msfa feeds back the source's own output, full level being ±1: so on
  // the kernel's output, which is scaled by `unit`, divide by it.
  const loop = alg.feedback;
  return { alg, ratios, gains, envelopes, feedback: loop ? feedback / unit(loop.from) : 0 };
}

const SILENT_ENVELOPE: Dx7Envelope = {
  attack: MIN_STAGE_SECONDS,
  peak: SILENCE_DB,
  decay1: 0,
  brk: SILENCE_DB,
  decay2: 0,
  sustain: SILENCE_DB,
  release: MIN_STAGE_SECONDS,
};

/**
 * How long Play note holds a note of these operators before letting it
 * go: until the slowest carrier has reached its sustain, within limits.
 */
export function dx7NoteHold(number: number, operators: readonly Dx7Operator[]): number {
  const alg = algorithm(number);
  const longest = Math.max(
    0,
    ...alg.carriers.map(op => (operators[op] ? stageEnds(operators[op].envelope).decay2 : 0)),
  );
  return Math.min(6, Math.max(1, longest + 0.25));
}

/** The longest any operator takes to fall silent once let go. */
export function dx7ReleaseSeconds(operators: readonly Dx7Operator[]): number {
  return Math.max(0, ...operators.map(op => releaseSeconds(op.envelope)));
}

/** An organ's envelope: straight up to full, held there, let go quickly. */
export const HELD_ENVELOPE: Dx7Envelope = {
  attack: 0.005,
  peak: 0,
  decay1: 0,
  brk: 0,
  decay2: 0,
  sustain: 0,
  release: 0.3,
};

/** An operator at `ratio` and `level` dB, held, with no scaling. */
export function heldOperator(ratio: number, level: number | null): Dx7Operator {
  return {
    ratio,
    detune: 0,
    level,
    envelope: HELD_ENVELOPE,
    breakKey: 60,
    left: { curve: 'lin', depth: 0 },
    right: { curve: 'lin', depth: 0 },
    rateScaling: 1,
  };
}
