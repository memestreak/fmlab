// The sandbox's voice: six operators as a DX7 describes them, in clean
// units. Each operator has a ratio, a detune in cents, a level in dB, a
// four-part envelope (times in seconds, levels in dB) and keyboard
// scaling. The numbers follow msfa, the DX7 engine in Dexed
// (github.com/asb2m10/dexed, source/msfa): dx7note.cc and env.cc.
// Operators and algorithms keeps its simpler operator (operators.ts).

import { algorithm } from './algorithms';
import { dx7LfoDelay, dx7LfoHz, dx7TremoloDb, dx7VibratoCents } from './lfo';
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

/** The LFO's six waves, in the DX7's order. */
export const LFO_WAVES = ['triangle', 'sawDown', 'sawUp', 'square', 'sine', 'sampleHold'] as const;
export type LfoWave = (typeof LFO_WAVES)[number];

/**
 * The voice's LFO (dsp/lfo.ts): one for the whole instrument. Its speed
 * in Hz; its delay in seconds after a key goes down, before it fades in;
 * how far it swings every operator's pitch, in cents (the DX7's PMD and
 * PMS in one); how far it pulls levels down, in dB, for an operator that
 * takes all of it (the DX7's AMD); and key sync, which starts the wave
 * again on each key. Then what the mod wheel adds at full (Jeremy,
 * 2026-10-21; on the DX7 its pitch and amplitude assign): `wheelVibrato`
 * in cents, `wheelTremolo` in dB, on top of `vibrato` and `tremolo`.
 */
export interface Dx7Lfo {
  wave: LfoWave;
  speed: number;
  delay: number;
  vibrato: number;
  tremolo: number;
  sync: boolean;
  wheelVibrato: number;
  wheelTremolo: number;
}

/** The LFO as a DX7 voice stores it: the wheel's depths are not in it. */
export type Dx7VoiceLfo = Omit<Dx7Lfo, 'wheelVibrato' | 'wheelTremolo'>;

/** What the mod wheel adds at full, for every voice that does not say. */
export const WHEEL_DEPTHS = { wheelVibrato: 50, wheelTremolo: 0 } as const;

/** The LFO's ranges: the DX7's 0 to 99 (and PMS 7), in these units. */
export const LFO_SPEED = { min: dx7LfoHz(0), max: dx7LfoHz(99) };
export const LFO_DELAY = { min: 0, max: dx7LfoDelay(99) };
export const LFO_VIBRATO = { min: 0, max: dx7VibratoCents(99, 7) };
export const LFO_TREMOLO = { min: 0, max: dx7TremoloDb(99) };

/** An LFO that does nothing: no vibrato or tremolo, a triangle at 5.8 Hz (speed 35), synced. */
export const HELD_LFO: Dx7Lfo = {
  wave: 'triangle',
  speed: Number(dx7LfoHz(35).toFixed(4)),
  delay: 0,
  vibrato: 0,
  tremolo: 0,
  sync: true,
  ...WHEEL_DEPTHS,
};

/**
 * The vibrato (cents) and tremolo (dB) heard with the mod wheel at
 * `wheel`, 0 to 1: the LFO's own depth and the wheel's share of its
 * depth at full, held under the LFO's ranges.
 */
export function lfoDepths(
  lfo: Dx7Lfo,
  wheel: number,
  into: { vibrato: number; tremolo: number } = { vibrato: 0, tremolo: 0 },
): { vibrato: number; tremolo: number } {
  // Written into `into` where given: the audio thread makes nothing new.
  into.vibrato = Math.min(LFO_VIBRATO.max, lfo.vibrato + wheel * lfo.wheelVibrato);
  into.tremolo = Math.min(LFO_TREMOLO.max, lfo.tremolo + wheel * lfo.wheelTremolo);
  return into;
}

/** Whether an LFO does anything, with the wheel at `wheel`: vibrato or tremolo above zero. */
export function lfoOn(lfo: Dx7Lfo, wheel = 0): boolean {
  const { vibrato, tremolo } = lfoDepths(lfo, wheel);
  return vibrato > 0 || tremolo > 0;
}

/**
 * The voice's pitch envelope (the DX7's pitch EG): every note runs its own
 * from its key down, and it bends all six operators together. Levels in
 * cents from the note: the pitch at the key (`start`, the DX7's L4), then
 * `peak`, `brk` and `sustain` (L1 to L3). The four parts are speeds, in
 * cents a second, as on the DX7 (R1 to R4): `attack` glides from start to
 * peak, `decay1` to the break, `decay2` to the sustain, held while the key
 * is down; at key up `release` glides from wherever the pitch is back to
 * start. A part that does not move takes no time.
 */
export interface Dx7PitchEnvelope {
  start: number;
  attack: number;
  peak: number;
  decay1: number;
  brk: number;
  decay2: number;
  sustain: number;
  release: number;
}

/** A pitch envelope's levels: four octaves either way, in cents. */
export const PITCH_ENVELOPE_CENTS = { min: -4800, max: 4800 };

/**
 * A pitch envelope's speeds, in cents a second: msfa's pitchenv_rate[R] /
 * 21.3 octaves a second for the DX7's rates 0 and 99, about 0.56 to 144
 * semitones a second.
 */
export const PITCH_EG_SPEED = { min: (1200 * 1) / 21.3, max: (1200 * 255) / 21.3 };

/** A pitch envelope that leaves the pitch alone. */
export const FLAT_PITCH_ENVELOPE: Dx7PitchEnvelope = {
  start: 0,
  attack: PITCH_EG_SPEED.max,
  peak: 0,
  decay1: PITCH_EG_SPEED.max,
  brk: 0,
  decay2: PITCH_EG_SPEED.max,
  sustain: 0,
  release: PITCH_EG_SPEED.max,
};

/** Whether a pitch envelope bends the pitch at all. */
export function pitchEnvelopeOn(env: Dx7PitchEnvelope): boolean {
  return env.start !== 0 || env.peak !== 0 || env.brk !== 0 || env.sustain !== 0;
}

/** How long a glide from `from` to `to` cents takes at `speed` cents a second. */
export function glideSeconds(from: number, to: number, speed: number): number {
  return from === to ? 0 : Math.abs(to - from) / Math.max(PITCH_EG_SPEED.min, speed);
}

/** The pitch, in cents, a glide from `from` to `to` at `speed` reaches `t` seconds in. */
function glide(from: number, to: number, speed: number, t: number): number {
  const length = glideSeconds(from, to, speed);
  return t >= length ? to : from + ((to - from) * t) / length;
}

/** The pitch envelope while the key is down, `time` seconds after it. */
function heldPitch(env: Dx7PitchEnvelope, time: number): number {
  let t = time;
  const attack = glideSeconds(env.start, env.peak, env.attack);
  if (t < attack) return glide(env.start, env.peak, env.attack, t);
  t -= attack;
  const decay1 = glideSeconds(env.peak, env.brk, env.decay1);
  if (t < decay1) return glide(env.peak, env.brk, env.decay1, t);
  t -= decay1;
  return glide(env.brk, env.sustain, env.decay2, t);
}

/**
 * The pitch envelope, in cents, `time` seconds into a note let go at
 * `hold` (Infinity while the key is down): start at the key, then each
 * part a straight line at its speed, held at the sustain; once let go, a
 * straight line from wherever it had got to back to start, at the release
 * speed, as msfa's pitchenv.cc. The pool calls it every sample, so it
 * makes nothing new.
 */
export function dx7PitchAt(env: Dx7PitchEnvelope, time: number, hold = Infinity): number {
  if (time <= 0) return env.start;
  if (time <= hold) return heldPitch(env, time);
  return glide(heldPitch(env, hold), env.start, env.release, time - hold);
}

/**
 * Where a live edit found an envelope (Jeremy, 2026-10-22: edits reach
 * notes already sounding): the part it was in, attack to release. The
 * curve carries on from there with the envelope as edited, as msfa's Env
 * does, rather than starting again from the key.
 */
export type EnvelopePart = 'attack' | 'decay1' | 'decay2' | 'sustain' | 'release';

/** How long a live edit's glides take: gains, ratios, feedback, an anchored part at least. */
export const LIVE_GLIDE_SECONDS = 0.02;

/**
 * Where a pitch envelope was when edited: `at` seconds after the key, at
 * `cents`, in `part`. The anchor at the key (`at` 0, the attack) is the
 * curve as struck, from the envelope's start, whatever `cents` says.
 */
export interface Dx7PitchAnchor {
  at: number;
  cents: number;
  part: EnvelopePart;
}

/** The anchor every note is struck with: the curve from its key. */
export function keyPitchAnchor(): Dx7PitchAnchor {
  return { at: 0, cents: 0, part: 'attack' };
}

/** Scratch: the part the last walk of a held curve ended in. */
let walkedPart: EnvelopePart = 'attack';
const HELD_PARTS: readonly EnvelopePart[] = ['attack', 'decay1', 'decay2', 'sustain'];

/**
 * A held pitch envelope from `anchor`: on from its cents, each part a
 * straight line at that part's speed towards that part's level, then the
 * later parts as set. A part already passed in the direction it goes is
 * over at once; the sustain heads for the sustain at the second decay's
 * speed. The audio thread calls it every sample: it makes nothing new.
 */
function heldPitchFrom(env: Dx7PitchEnvelope, anchor: Dx7PitchAnchor, time: number): number {
  let t = time - anchor.at;
  let i = HELD_PARTS.indexOf(anchor.part);
  let cents = anchor.at === 0 && anchor.part === 'attack' ? env.start : anchor.cents;
  for (; i < 3; i++) {
    const start = i === 0 ? env.start : i === 1 ? env.peak : env.brk;
    const end = i === 0 ? env.peak : i === 1 ? env.brk : env.sustain;
    const speed = i === 0 ? env.attack : i === 1 ? env.decay1 : env.decay2;
    if (cents === end) continue;
    // Passed: an edit left the pitch beyond where this part was going.
    if (start !== end && (end - cents) * Math.sign(end - start) < 0) continue;
    const length = glideSeconds(cents, end, speed);
    if (t < length) {
      walkedPart = HELD_PARTS[i];
      return cents + ((end - cents) * t) / length;
    }
    t -= length;
    cents = end;
  }
  walkedPart = 'sustain';
  return glide(cents, env.sustain, env.decay2, t);
}

/**
 * The pitch envelope, in cents, `time` seconds into a note let go at
 * `hold`, carried on from `anchor` with `env` as it is now. From the
 * anchor at the key it is exactly `dx7PitchAt`. Let go, it glides from
 * wherever it had got to back to start at the release speed; an anchor
 * in the release glides from its own cents.
 */
export function dx7PitchFrom(env: Dx7PitchEnvelope, anchor: Dx7PitchAnchor, time: number, hold = Infinity): number {
  if (time <= 0) return env.start;
  if (anchor.at === 0 && anchor.part === 'attack') return dx7PitchAt(env, time, hold);
  if (anchor.part === 'release') return glide(anchor.cents, env.start, env.release, time - anchor.at);
  if (time <= hold) return heldPitchFrom(env, anchor, time);
  return glide(heldPitchFrom(env, anchor, Math.max(hold, anchor.at)), env.start, env.release, time - hold);
}

/**
 * The anchor a pitch envelope edited at `time` carries on from: where the
 * curve as it was (`env` from `anchor`) had got to, and in which part.
 * Written into `into` if given, so the audio thread makes nothing new.
 */
export function pitchAnchorAt(
  env: Dx7PitchEnvelope,
  anchor: Dx7PitchAnchor,
  time: number,
  hold = Infinity,
  into: Dx7PitchAnchor = keyPitchAnchor(),
): Dx7PitchAnchor {
  const cents = dx7PitchFrom(env, anchor, time, hold);
  const released = anchor.part === 'release' || time > hold;
  if (!released && time > 0) heldPitchFrom(env, anchor, time);
  const part: EnvelopePart = released ? 'release' : time <= 0 ? 'attack' : walkedPart;
  into.at = Math.max(0, time);
  into.cents = cents;
  into.part = part;
  return into;
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
  /**
   * Its share of the LFO's tremolo, 0 to 1: one of the DX7's four AMS
   * steps (`AMS_SHARES`), none, about a quarter, about two fifths, all.
   */
  tremolo: number;
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

/**
 * Where an operator's envelope was when edited: `at` seconds after the
 * key, at `db`, in `part`. The anchor at the key (`at` 0, the attack) is
 * the curve as struck, from silence.
 */
export interface Dx7EnvelopeAnchor {
  at: number;
  db: number;
  part: EnvelopePart;
}

/** The anchor every note is struck with: the curve from its key. */
export function keyAnchor(): Dx7EnvelopeAnchor {
  return { at: 0, db: SILENCE_DB, part: 'attack' };
}

/** Whether an anchor is the one at the key: the curve as `dx7EnvelopeAt` draws it. */
export function atKey(anchor: { at: number; part: EnvelopePart }): boolean {
  return anchor.at === 0 && anchor.part === 'attack';
}

/**
 * A held envelope from `anchor`, 0 to 1: from its level, each part heads
 * for that part's level at that part's speed (its distance over its time
 * as set, run faster for the key already), then the later parts as set.
 * The attack is a straight line in amplitude, at the speed that takes
 * silence to the peak in the attack's time; the decays are straight lines
 * in dB. A part already passed in the direction it goes is over at once,
 * as in msfa when a target is crossed; a part as set that does not move
 * takes its time. The sustain heads for the sustain at the second
 * decay's speed. The part an edit lands in takes at least
 * LIVE_GLIDE_SECONDS, so no edit steps the level. The audio thread calls
 * it every sample: it makes nothing new.
 */
function heldFrom(env: Dx7Envelope, anchor: Dx7EnvelopeAnchor, time: number): number {
  let t = time - anchor.at;
  let edited = !atKey(anchor);
  let i = HELD_PARTS.indexOf(anchor.part);
  let db = anchor.db;
  if (i === 0) {
    const attack = Math.max(MIN_STAGE_SECONDS, env.attack);
    const peak = dbToAmp(env.peak);
    const from = edited ? dbToAmp(anchor.db) : 0;
    if (from < peak || peak === 0) {
      let length = peak === 0 ? attack : (attack * (peak - from)) / peak;
      if (edited) length = Math.max(length, LIVE_GLIDE_SECONDS);
      if (t < length) {
        walkedPart = 'attack';
        return peak === 0 ? from * (1 - t / length) : from + ((peak - from) * t) / length;
      }
      t -= length;
      db = env.peak;
      edited = false;
    }
    i = 1;
  }
  for (; i < 4; i++) {
    const start = i === 1 ? env.peak : env.brk;
    const end = i === 1 ? env.brk : env.sustain;
    const seconds = i === 1 ? env.decay1 : env.decay2;
    let length: number;
    if (i === 3) {
      // The sustain: held there, or, edited, heading for it.
      if (db === end) break;
      length = start === end ? seconds : (seconds * Math.abs(end - db)) / Math.abs(end - start);
    } else if (start === end) {
      length = seconds;
    } else if ((end - db) * Math.sign(end - start) <= 0) {
      continue;
    } else {
      length = (seconds * Math.abs(end - db)) / Math.abs(end - start);
    }
    if (edited) length = Math.max(length, LIVE_GLIDE_SECONDS);
    if (t < length) {
      walkedPart = HELD_PARTS[i];
      return dbToAmp(db + ((end - db) * t) / length);
    }
    t -= length;
    db = end;
    edited = false;
  }
  walkedPart = 'sustain';
  return dbToAmp(db);
}

/**
 * The envelope's level, 0 to 1, `time` seconds into a note let go at
 * `hold`, carried on from `anchor` with `env` as it is now. From the
 * anchor at the key it is exactly `dx7EnvelopeAt`. Let go, it falls from
 * wherever it had got to at the release's speed; an anchor in the release
 * falls from its own level.
 */
export function dx7EnvelopeFrom(env: Dx7Envelope, anchor: Dx7EnvelopeAnchor, time: number, hold = Infinity): number {
  if (time <= 0) return 0;
  if (atKey(anchor)) return dx7EnvelopeAt(env, time, hold);
  const speed = -SILENCE_DB / Math.max(MIN_STAGE_SECONDS, env.release);
  if (anchor.part === 'release') return dbToAmp(anchor.db - (time - anchor.at) * speed);
  if (time <= hold) return heldFrom(env, anchor, time);
  const from = ampToDb(heldFrom(env, anchor, Math.max(hold, anchor.at)));
  return dbToAmp(from - (time - hold) * speed);
}

/**
 * The anchor an envelope edited at `time` carries on from: where the
 * curve as it was (`env` from `anchor`) had got to, and in which part.
 * Written into `into` if given, so the audio thread makes nothing new;
 * a second edit anchors from the first.
 */
export function anchorAt(
  env: Dx7Envelope,
  anchor: Dx7EnvelopeAnchor,
  time: number,
  hold = Infinity,
  into: Dx7EnvelopeAnchor = keyAnchor(),
): Dx7EnvelopeAnchor {
  if (time <= 0) {
    into.at = 0;
    into.db = SILENCE_DB;
    into.part = 'attack';
    return into;
  }
  const db = ampToDb(dx7EnvelopeFrom(env, anchor, time, hold));
  const released = anchor.part === 'release' || time > hold;
  // The part it is in: the walk of the held curve says.
  if (!released) heldFrom(env, anchor, time);
  const part: EnvelopePart = released ? 'release' : walkedPart;
  into.at = time;
  into.db = db;
  into.part = part;
  return into;
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
  /** Each operator's share of the LFO's tremolo, 0 to 1. */
  tremolo: Float64Array;
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
  const tremolo = new Float64Array(MAX_OPERATORS);
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
    tremolo[op] = o.tremolo;
    const db = levelAtKey(o, key);
    gains[op] = db === null ? 0 : unit(op) * dbToAmp(db);
    envelopes.push(fasterEnvelope(o.envelope, rateScalingFactor(o.rateScaling, key)));
  }
  // msfa feeds back the source's own output, full level being ±1: so on
  // the kernel's output, which is scaled by `unit`, divide by it.
  const loop = alg.feedback;
  return { alg, ratios, gains, envelopes, feedback: loop ? feedback / unit(loop.from) : 0, tremolo };
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
    tremolo: 0,
  };
}
