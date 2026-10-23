import { algorithm } from './algorithms';
import {
  anchorAt,
  atKey,
  type Dx7Envelope,
  type Dx7EnvelopeAnchor,
  dx7EnvelopeAt,
  dx7EnvelopeFrom,
  type Dx7Lfo,
  type Dx7Note,
  dx7Note,
  type Dx7Operator,
  dx7PitchFrom,
  type Dx7PitchAnchor,
  type Dx7PitchEnvelope,
  FLAT_PITCH_ENVELOPE,
  glideSeconds,
  keyAnchor,
  keyOf,
  keyPitchAnchor,
  lfoDepths,
  LIVE_GLIDE_SECONDS,
  pitchAnchorAt,
  MIN_STAGE_SECONDS,
  pitchEnvelopeOn,
} from './dx7';
import { type Envelope, envelopeAt } from './envelope';
import { AMS_SHARES, Lfo } from './lfo';
import { kernelLevels, type Operator, operatorEnvelope } from './operators';
import { type Algorithm, MAX_OPERATORS, PmKernel } from './pmKernel';
import { chooseVoice, type VoiceState } from './voices';

/**
 * How many notes sound at once: 16, as the DX7 (8 until MIDI In, whose
 * sustain pedal holds more). A voice costs only while it sounds.
 */
export const VOICES = 16;
/** A voice taken for a new note is faded out over this long first: no click. */
export const STEAL_SECONDS = 0.005;
/** A voice is free once every carrier is below this, -90 dB. */
export const SILENT = 10 ** (-90 / 20);

/**
 * What every note is struck with: the six operators and their wiring.
 * Operators and algorithms' simple operators (ratio, level, one decay),
 * or the sandbox's DX7 voice (dsp/dx7.ts).
 */
export type VoicePatch = BasicPatch | Dx7Patch;

export interface BasicPatch {
  kind?: 'basic';
  algorithm: number;
  feedback: number;
  operators: readonly Operator[];
}

export interface Dx7Patch {
  kind: 'dx7';
  algorithm: number;
  /** In radians on the source's own output (dsp/dx7.ts). */
  feedback: number;
  operators: readonly Dx7Operator[];
  /** The LFO, which every sounding note shares. */
  lfo: Dx7Lfo;
  /** The pitch envelope, which each note runs its own copy of. */
  pitchEnvelope: Dx7PitchEnvelope;
}

/** What the main thread tells the pool, over the worklet's port. */
export type VoiceMessage =
  /**
   * `live`: an edit from the sandbox's controls, which reaches the notes
   * already sounding too (Jeremy, 2026-10-22); otherwise (a preset, a
   * link) only the notes struck next.
   */
  | { type: 'patch'; patch: VoicePatch; live?: boolean }
  /**
   * `hold`: seconds until the note lets itself go; Infinity until noteOff.
   * `velocity`: a MIDI key's, 0 to 127, carried for the next version, not
   * yet heard.
   */
  | { type: 'noteOn'; note: number; hz: number; hold: number; velocity?: number }
  | { type: 'noteOff'; note: number }
  /** Everything silenced at once, faded over STEAL_SECONDS. */
  | { type: 'allOff' }
  /** The mod wheel, 0 to 1: glided to over WHEEL_GLIDE_SECONDS. */
  | { type: 'wheel'; amount: number }
  /** The pitch wheel, in semitones (its position times the Bend range): glided to over BEND_GLIDE_SECONDS. */
  | { type: 'bend'; semitones: number };

/**
 * A DX7 note's envelopes and pitch envelope are worked out every this many
 * samples (0.67 ms at 48 kHz), and followed in straight lines between
 * (the DX7 and Dexed step theirs every 64): the curves' own functions
 * (dx7.ts) at a control rate, not every sample. A run ends early where an
 * envelope turns a corner (the end of a part, the moment it is let go),
 * so the corners are where they belong.
 */
export const CONTROL_SAMPLES = 32;

/** How long the pool takes to follow the pitch wheel: short, as a bend that lags is heard. */
export const BEND_GLIDE_SECONDS = 0.005;

/** How long the pool takes to follow the mod wheel, so a drag does not zipper. */
export const WHEEL_GLIDE_SECONDS = 0.03;

/** A note waiting for its voice to fade out. */
interface Waiting {
  hz: number;
  hold: number;
  patch: VoicePatch;
}

/** One note's worth of synth: a kernel and each operator's envelope. */
class Voice implements VoiceState {
  // What choosing a voice goes by, in samples on the pool's clock. These
  // change the moment a note is asked for, before it is heard.
  note: number | null = null;
  struckAt = 0;
  releasedAt: number | null = null;

  // What is sounding.
  sounding = false;
  readonly kernel: PmKernel;
  alg: Algorithm = algorithm(1);
  feedback = 0;
  /** The note's frequency, in cycles per sample. */
  baseFreq = 0;
  readonly ratios = new Float64Array(MAX_OPERATORS);
  readonly levels = new Float64Array(MAX_OPERATORS);
  operators: readonly Operator[] = [];
  envelopes: Envelope[] = [];
  /** A DX7 voice's note as struck, or null for simple operators. */
  dx7: Dx7Note | null = null;
  /** A DX7 note's algorithm and key: an edit keeps both. */
  algorithm = 1;
  key = 60;
  /**
   * A DX7 note's levels as the kernel takes them and its tremolo shares,
   * as heard (gliding after an edit); its ratios are `ratios`, its
   * feedback `feedback`.
   */
  readonly gains = new Float64Array(MAX_OPERATORS);
  readonly tremolo = new Float64Array(MAX_OPERATORS);
  /** Each operator's envelope as it is now, and where an edit found it. */
  envelopes7: Dx7Envelope[] = [];
  readonly anchors: Dx7EnvelopeAnchor[] = Array.from({ length: MAX_OPERATORS }, keyAnchor);
  /** A DX7 note's pitch envelope as it is now; null if flat. */
  pitchEnvelope: Dx7PitchEnvelope | null = null;
  readonly pitchAnchor: Dx7PitchAnchor = keyPitchAnchor();
  /** An edit's glide: from and to, and the samples left of it. */
  readonly gainsFrom = new Float64Array(MAX_OPERATORS);
  readonly gainsTo = new Float64Array(MAX_OPERATORS);
  readonly ratiosFrom = new Float64Array(MAX_OPERATORS);
  readonly ratiosTo = new Float64Array(MAX_OPERATORS);
  readonly tremoloFrom = new Float64Array(MAX_OPERATORS);
  readonly tremoloTo = new Float64Array(MAX_OPERATORS);
  feedbackFrom = 0;
  feedbackTo = 0;
  glideLeft = 0;
  glideTotal = 1;
  /**
   * The control rate's run: each operator's envelope level now, and how
   * it moves a sample, times `envTimes` plus `envStep` (an attack is a
   * straight line in amplitude, a step; a decay or a release a straight
   * line in dB, a factor); the pitch envelope's factor and its factor a
   * sample (straight in cents); and the samples left of the run (0: work
   * out the next).
   */
  readonly envNow = new Float64Array(MAX_OPERATORS);
  readonly envTimes = new Float64Array(MAX_OPERATORS).fill(1);
  readonly envStep = new Float64Array(MAX_OPERATORS);
  pitchNow = 1;
  pitchTimes = 1;
  controlLeft = 0;
  /** The longest attack of its envelopes, in seconds: before it ends a voice is not checked for silence. */
  longestAttack = 0;
  /** When the note is let go, in seconds; Infinity while it is held. */
  hold = Infinity;
  /** Samples since the note started. */
  age = 0;
  /** Samples left of a fade out; 0 when not fading. */
  fadeLeft = 0;
  /** The note to start once the fade is over, if any. */
  waiting: Waiting | null = null;
  /** Scratch: each operator's level now, and as the kernel takes it. */
  readonly heard = new Float64Array(MAX_OPERATORS);
  readonly scaled = new Float64Array(MAX_OPERATORS);

  constructor(lockSamples: number) {
    this.kernel = new PmKernel(algorithm(1), lockSamples);
  }
}

/**
 * Several notes of six operators at once, a sample at a time: the
 * sandbox's and Operators and algorithms' synth. No Web Audio in it, so
 * the worklet runs it and the tests run it in node.
 *
 * Each voice is a PmKernel whose operator levels follow their envelopes
 * (`operatorEnvelope`, as the figures draw them), computed here on the
 * audio thread. A note takes up the patch as it was when struck; then a
 * DX7 voice's edits from the controls (`live`) reach it too (Jeremy,
 * 2026-10-22): its ratios, levels, tremolo shares and feedback glide to
 * the new ones over LIVE_GLIDE_SECONDS, and its envelopes and pitch
 * envelope carry on from where they are with the new settings. It keeps
 * the algorithm it was struck with. A preset or a link is a new voice,
 * for the notes struck next.
 */
export class VoicePool {
  private readonly voices: Voice[];
  private readonly fadeSamples: number;
  private patch: VoicePatch = { algorithm: 1, feedback: 0, operators: [] };
  /** Samples rendered: the clock voices are chosen by. */
  private now = 0;
  /** The DX7 voice's LFO, one for every note, as on the DX7. */
  private readonly lfo = new Lfo();
  /** This sample's vibrato, as a factor on every note's frequency. */
  private pitch = 1;
  /** This sample's tremolo, in dB, for an operator that takes all of it. */
  private pull = 0;
  /** The LFO's depths with the wheel, worked out into this (nothing new a sample). */
  private readonly depths = { vibrato: 0, tremolo: 0 };
  /** This sample's tremolo factor for each of the DX7's AMS shares but none. */
  private trem1 = 1;
  private trem2 = 1;
  private trem3 = 1;
  /** The pitch wheel as heard, in semitones, gliding to `bendTarget`, and its factor on every note's frequency. */
  private bend = 0;
  private bendTarget = 0;
  private bendStep = 0;
  private bendFactor = 1;
  /** The mod wheel as heard, gliding towards `wheelTarget`. */
  private wheel = 0;
  private wheelTarget = 0;
  /** How far the wheel glides in a sample: the last move over WHEEL_GLIDE_SECONDS. */
  private wheelStep = 1;

  constructor(
    count: number,
    private readonly sampleRate: number,
    lockSamples: number,
    /** How often the envelopes are worked out, in samples: 1 is every sample, for the tests. */
    private readonly controlSamples = CONTROL_SAMPLES,
  ) {
    this.voices = Array.from({ length: count }, () => new Voice(lockSamples));
    this.fadeSamples = Math.max(1, Math.round(STEAL_SECONDS * sampleRate));
  }

  handle(message: VoiceMessage): void {
    if (message.type === 'patch') this.setPatch(message.patch, message.live === true);
    else if (message.type === 'noteOn') this.noteOn(message.note, message.hz, message.hold);
    else if (message.type === 'noteOff') this.noteOff(message.note);
    else if (message.type === 'wheel') this.setWheel(message.amount);
    else if (message.type === 'bend') this.setBend(message.semitones);
    else this.allOff();
  }

  /** Moves the pitch wheel to `semitones`; every note's pitch glides there. */
  setBend(semitones: number): void {
    this.bendTarget = semitones;
    this.bendStep = Math.abs(semitones - this.bend) / Math.max(1, BEND_GLIDE_SECONDS * this.sampleRate);
  }

  /** Moves the mod wheel to `amount`, 0 to 1; the sound glides there. */
  setWheel(amount: number): void {
    this.wheelTarget = Math.min(1, Math.max(0, amount));
    this.wheelStep = Math.abs(this.wheelTarget - this.wheel) / Math.max(1, WHEEL_GLIDE_SECONDS * this.sampleRate);
  }

  /** The patch the next note takes; `live`, the notes sounding too. */
  setPatch(patch: VoicePatch, live = false): void {
    this.patch = structuredCloneOf(patch);
    const now = this.patch;
    if (now.kind !== 'dx7') return;
    this.lfo.set(now.lfo, this.sampleRate);
    if (!live) return;
    for (const voice of this.voices) {
      // A note waiting for its voice takes the edit too, but keeps its algorithm.
      if (voice.waiting) voice.waiting.patch = { ...now, algorithm: voice.waiting.patch.algorithm };
      else if (voice.sounding && voice.dx7 && voice.fadeLeft === 0) this.edit(voice, now);
    }
  }

  /**
   * An edit reaching a sounding note: the note worked out again at its
   * key with its own algorithm; its gains, ratios, tremolo shares and
   * feedback glide there; each envelope carries on from where it is.
   */
  private edit(voice: Voice, patch: Dx7Patch): void {
    const time = voice.age / this.sampleRate;
    const note = dx7Note(voice.algorithm, patch.operators, patch.feedback, voice.key);
    for (let op = 0; op < MAX_OPERATORS; op++) {
      anchorAt(voice.envelopes7[op], voice.anchors[op], time, voice.hold, voice.anchors[op]);
    }
    voice.envelopes7 = note.envelopes;
    // The pitch envelope from where it is; one turned flat glides back to
    // the note rather than stopping where it was.
    pitchAnchorAt(voice.pitchEnvelope ?? FLAT_PITCH_ENVELOPE, voice.pitchAnchor, time, voice.hold, voice.pitchAnchor);
    const bends = pitchEnvelopeOn(patch.pitchEnvelope) || voice.pitchAnchor.cents !== 0;
    voice.pitchEnvelope = bends ? patch.pitchEnvelope : null;
    if (!bends) Object.assign(voice.pitchAnchor, keyPitchAnchor());
    voice.gainsFrom.set(voice.gains);
    voice.ratiosFrom.set(voice.ratios);
    voice.tremoloFrom.set(voice.tremolo);
    voice.feedbackFrom = voice.feedback;
    voice.gainsTo.set(note.gains);
    voice.ratiosTo.set(note.ratios);
    voice.tremoloTo.set(note.tremolo);
    voice.feedbackTo = note.feedback;
    voice.glideTotal = Math.max(1, Math.round(LIVE_GLIDE_SECONDS * this.sampleRate));
    voice.glideLeft = voice.glideTotal;
    voice.longestAttack = longestAttack(voice.envelopes7);
    // A new run from here: the curves have changed under it.
    voice.controlLeft = 0;
  }

  /** One sample further along an edit's glide: ratios in cents, the rest straight. */
  private glide(voice: Voice): void {
    voice.glideLeft--;
    const f = 1 - voice.glideLeft / voice.glideTotal;
    for (let op = 0; op < MAX_OPERATORS; op++) {
      voice.gains[op] = voice.gainsFrom[op] + (voice.gainsTo[op] - voice.gainsFrom[op]) * f;
      voice.tremolo[op] = voice.tremoloFrom[op] + (voice.tremoloTo[op] - voice.tremoloFrom[op]) * f;
      const from = voice.ratiosFrom[op];
      const to = voice.ratiosTo[op];
      voice.ratios[op] = voice.glideLeft === 0 || from <= 0 ? to : from * (to / from) ** f;
    }
    voice.feedback = voice.feedbackFrom + (voice.feedbackTo - voice.feedbackFrom) * f;
  }

  /** Strikes `note` at `hz`; it lets itself go after `hold` seconds. */
  noteOn(note: number, hz: number, hold = Infinity): void {
    // Every key restarts the LFO's delay, for the notes already held too.
    this.lfo.keyDown();
    const voice = this.voices[chooseVoice(this.voices, note)];
    voice.note = note;
    voice.struckAt = this.now;
    voice.releasedAt = null;
    const waiting = { hz, hold, patch: this.patch };
    if (voice.sounding) {
      // Faded out first, then started.
      voice.waiting = waiting;
      if (voice.fadeLeft === 0) voice.fadeLeft = this.fadeSamples;
    } else {
      this.start(voice, waiting);
    }
  }

  /** Lets `note` go: each operator releases from where it has got to. */
  noteOff(note: number): void {
    const voice = this.voices.find(v => v.note === note && v.releasedAt === null);
    if (!voice) return;
    voice.releasedAt = this.now;
    if (voice.waiting) voice.waiting.hold = 0;
    else this.letGo(voice);
  }

  /** Silences every voice, faded over STEAL_SECONDS. */
  allOff(): void {
    for (const voice of this.voices) {
      voice.note = null;
      voice.releasedAt = null;
      voice.waiting = null;
      if (voice.sounding && voice.fadeLeft === 0) voice.fadeLeft = this.fadeSamples;
    }
  }

  /** Every voice free at once, unheard: for when the pool is not playing. */
  reset(): void {
    for (const voice of this.voices) {
      voice.note = null;
      voice.releasedAt = null;
      voice.waiting = null;
      voice.sounding = false;
      voice.fadeLeft = 0;
    }
  }

  /**
   * A DX7 note's levels as the kernel takes them now, before tremolo:
   * what the figures should draw of it. Null if `note` is not sounding.
   */
  kernelLevelsOf(note: number): number[] | null {
    const voice = this.voices.find(v => v.note === note && v.sounding && v.dx7);
    if (!voice) return null;
    const time = voice.age / this.sampleRate;
    return Array.from(voice.gains, (gain, op) => gain * this.envelopeLevel(voice, op, time));
  }

  /** How many voices are sounding. */
  get active(): number {
    return this.voices.filter(voice => voice.sounding).length;
  }

  /** Fills `out` with the sum of every voice. */
  render(out: Float32Array): void {
    const { voices, sampleRate } = this;
    const dx7 = this.patch.kind === 'dx7';
    const lfoPatch = dx7 ? (this.patch as Dx7Patch).lfo : null;
    const depths = this.depths;
    // The tremolo's factors only while a voice sounds to take them.
    let sounding = false;
    for (let v = 0; v < voices.length; v++) if (voices[v].sounding) sounding = true;
    if (lfoPatch) lfoDepths(lfoPatch, this.wheel, depths);
    else depths.vibrato = depths.tremolo = 0;
    for (let i = 0; i < out.length; i++) {
      // The pitch wheel, glided, as one factor on every note's frequency.
      if (this.bend !== this.bendTarget) {
        const gap = this.bendTarget - this.bend;
        this.bend = Math.abs(gap) <= this.bendStep ? this.bendTarget : this.bend + Math.sign(gap) * this.bendStep;
        this.bendFactor = 2 ** (this.bend / 12);
      }
      // The LFO once a sample, before the voices, which all share it.
      if (lfoPatch) {
        // The wheel's depth added on, glided so a drag does not zipper.
        if (this.wheel !== this.wheelTarget) {
          const gap = this.wheelTarget - this.wheel;
          this.wheel = Math.abs(gap) <= this.wheelStep ? this.wheelTarget : this.wheel + Math.sign(gap) * this.wheelStep;
          lfoDepths(lfoPatch, this.wheel, depths);
        }
        const lfo = this.lfo.next();
        this.pitch = 2 ** ((depths.vibrato * lfo.pitch) / 1200);
        const pull = depths.tremolo * lfo.amp;
        this.pull = pull;
        // The tremolo's factor for each AMS share, once for every voice.
        if (pull > 0 && sounding) {
          this.trem1 = 10 ** ((-pull * AMS_SHARES[1]) / 20);
          this.trem2 = 10 ** ((-pull * AMS_SHARES[2]) / 20);
          this.trem3 = 10 ** ((-pull * AMS_SHARES[3]) / 20);
        }
      }
      let sample = 0;
      for (let v = 0; v < voices.length; v++) {
        const voice = voices[v];
        if (voice.sounding) sample += this.tick(voice, sampleRate);
      }
      out[i] = sample;
      this.now++;
    }
    for (let v = 0; v < voices.length; v++) this.settle(voices[v]);
  }

  /** One voice's next sample. */
  private tick(voice: Voice, sampleRate: number): number {
    const time = voice.age / sampleRate;
    let sample: number;
    if (voice.dx7) {
      if (voice.glideLeft > 0) this.glide(voice);
      if (voice.controlLeft === 0) this.control(voice, time);
      voice.controlLeft--;
      const pull = this.pull;
      const { envNow, envTimes, envStep, gains, tremolo, scaled } = voice;
      for (let op = 0; op < MAX_OPERATORS; op++) {
        let level = gains[op] * envNow[op];
        envNow[op] = envNow[op] * envTimes[op] + envStep[op];
        // Tremolo only ever lowers a level, by the operator's share.
        const share = tremolo[op];
        if (share > 0 && pull > 0) {
          level *=
            share === AMS_SHARES[1] ? this.trem1
            : share === AMS_SHARES[2] ? this.trem2
            : share === AMS_SHARES[3] ? this.trem3
            : 10 ** ((-pull * share) / 20);
        }
        scaled[op] = level;
      }
      // The note's own pitch envelope, and the LFO's vibrato, in cents.
      let freq = voice.baseFreq * this.pitch * this.bendFactor;
      if (voice.pitchEnvelope) {
        freq *= voice.pitchNow;
        voice.pitchNow *= voice.pitchTimes;
      }
      sample = voice.kernel.tick(freq, voice.ratios, scaled, voice.feedback);
    } else {
      for (let op = 0; op < MAX_OPERATORS; op++) {
        voice.heard[op] = voice.levels[op] * envelopeAt(voice.envelopes[op], time);
      }
      sample = voice.kernel.tick(
        voice.baseFreq * this.bendFactor,
        voice.ratios,
        kernelLevels(voice.alg, voice.heard, voice.scaled),
        voice.feedback,
      );
    }
    voice.age++;
    if (voice.fadeLeft > 0) {
      sample *= voice.fadeLeft / this.fadeSamples;
      voice.fadeLeft--;
      if (voice.fadeLeft === 0) {
        voice.sounding = false;
        if (voice.waiting) this.start(voice, voice.waiting);
      }
    }
    return sample;
  }

  /**
   * The next control run of a DX7 note, from `time`: each envelope (and
   * the pitch envelope) at the curve's own value now, heading in a
   * straight line for its value at the run's end, CONTROL_SAMPLES on or
   * sooner where a curve turns a corner first.
   */
  private control(voice: Voice, time: number): void {
    const rate = this.sampleRate;
    const age = voice.age;
    let samples = this.controlSamples;
    if (Number.isFinite(voice.hold)) samples = cornerRun(voice.hold, rate, age, samples);
    for (let op = 0; op < MAX_OPERATORS; op++) {
      if (!atKey(voice.anchors[op])) continue;
      const env = voice.envelopes7[op];
      const attack = Math.max(MIN_STAGE_SECONDS, env.attack);
      samples = cornerRun(attack, rate, age, samples);
      samples = cornerRun(attack + env.decay1, rate, age, samples);
      samples = cornerRun(attack + env.decay1 + env.decay2, rate, age, samples);
    }
    const pitch = voice.pitchEnvelope;
    if (pitch && atKey(voice.pitchAnchor)) {
      const attack = glideSeconds(pitch.start, pitch.peak, pitch.attack);
      const decay1 = attack + glideSeconds(pitch.peak, pitch.brk, pitch.decay1);
      samples = cornerRun(attack, rate, age, samples);
      samples = cornerRun(decay1, rate, age, samples);
      samples = cornerRun(decay1 + glideSeconds(pitch.brk, pitch.sustain, pitch.decay2), rate, age, samples);
    }
    const end = (age + samples) / rate;
    for (let op = 0; op < MAX_OPERATORS; op++) {
      const now = this.envelopeLevel(voice, op, time);
      const then = this.envelopeLevel(voice, op, end);
      voice.envNow[op] = now;
      // In the attack, or to or from silence, a step a sample; otherwise
      // the factor a straight line in dB takes.
      const anchor = voice.anchors[op];
      // (A run never crosses a corner but in one sample, so it is in the
      // attack if it starts there.)
      const attack = atKey(anchor)
        ? time < Math.max(MIN_STAGE_SECONDS, voice.envelopes7[op].attack)
        : anchor.part === 'attack';
      if (attack || now <= 0 || then <= 0) {
        voice.envTimes[op] = 1;
        voice.envStep[op] = (then - now) / samples;
      } else {
        voice.envTimes[op] = (then / now) ** (1 / samples);
        voice.envStep[op] = 0;
      }
    }
    if (pitch) {
      const now = dx7PitchFrom(pitch, voice.pitchAnchor, time, voice.hold);
      voice.pitchNow = 2 ** (now / 1200);
      voice.pitchTimes = 2 ** ((dx7PitchFrom(pitch, voice.pitchAnchor, end, voice.hold) - now) / 1200 / samples);
    }
    voice.controlLeft = samples;
  }

  /** A DX7 note's operator `op`'s envelope, 0 to 1, from its key or its last edit. */
  private envelopeLevel(voice: Voice, op: number, time: number): number {
    const anchor = voice.anchors[op];
    return atKey(anchor)
      ? dx7EnvelopeAt(voice.envelopes7[op], time, voice.hold)
      : dx7EnvelopeFrom(voice.envelopes7[op], anchor, time, voice.hold);
  }

  /**
   * After each block: a note that lets itself go does so, and a voice
   * whose carriers have all died away is free.
   */
  private settle(voice: Voice): void {
    if (!voice.sounding || voice.fadeLeft > 0) return;
    const time = voice.age / this.sampleRate;
    if (voice.releasedAt === null && time >= voice.hold) voice.releasedAt = this.now;
    const dx7 = voice.dx7;
    if (time <= voice.longestAttack) return;
    const { carriers } = voice.alg;
    let silent = true;
    for (let i = 0; i < carriers.length && silent; i++) {
      const op = carriers[i];
      const level = dx7 ? this.envelopeLevel(voice, op, time) : envelopeAt(voice.envelopes[op], time);
      if (level >= SILENT) silent = false;
    }
    if (silent) {
      voice.sounding = false;
      voice.note = null;
      voice.releasedAt = null;
    }
  }

  private start(voice: Voice, { hz, hold, patch }: Waiting): void {
    voice.waiting = null;
    voice.alg = algorithm(patch.algorithm);
    voice.kernel.setAlgorithm(voice.alg);
    voice.kernel.reset();
    voice.baseFreq = hz / this.sampleRate;
    voice.hold = hold;
    if (patch.kind === 'dx7') {
      voice.algorithm = patch.algorithm;
      voice.key = keyOf(hz);
      const note = dx7Note(patch.algorithm, patch.operators, patch.feedback, voice.key);
      voice.dx7 = note;
      voice.gains.set(note.gains);
      voice.ratios.set(note.ratios);
      voice.tremolo.set(note.tremolo);
      voice.feedback = note.feedback;
      voice.envelopes7 = note.envelopes;
      for (const anchor of voice.anchors) Object.assign(anchor, keyAnchor());
      voice.pitchEnvelope = pitchEnvelopeOn(patch.pitchEnvelope) ? patch.pitchEnvelope : null;
      Object.assign(voice.pitchAnchor, keyPitchAnchor());
      voice.longestAttack = longestAttack(note.envelopes);
      voice.glideLeft = 0;
    } else {
      voice.dx7 = null;
      voice.feedback = patch.feedback;
      voice.operators = patch.operators;
      for (let op = 0; op < MAX_OPERATORS; op++) {
        voice.ratios[op] = patch.operators[op]?.ratio ?? 1;
        voice.levels[op] = patch.operators[op]?.level ?? 0;
      }
      voice.envelopes = this.envelopesFor(patch.operators, hold);
      voice.longestAttack = longestAttack(voice.envelopes);
    }
    voice.controlLeft = 0;
    voice.age = 0;
    voice.fadeLeft = 0;
    voice.sounding = true;
  }

  /** Lets a sounding voice go now. */
  private letGo(voice: Voice): void {
    if (!voice.sounding) return;
    voice.hold = voice.age / this.sampleRate;
    if (!voice.dx7) voice.envelopes = this.envelopesFor(voice.operators, voice.hold);
    // The release from here: a new control run, from the curve's level now.
    voice.controlLeft = 0;
  }

  private envelopesFor(operators: readonly Operator[], hold: number): Envelope[] {
    return Array.from({ length: MAX_OPERATORS }, (_, op) =>
      operatorEnvelope(operators[op] ?? { ratio: 1, level: 0, decay: 0 }, hold),
    );
  }
}

/**
 * The length of a control run from sample `age`, at most `samples`, that
 * a curve's corner `seconds` from the key leaves it: the run ends at the
 * last sample before the corner, and the next one crosses it in a single
 * sample, so every sample but those two runs' ends lies on a straight
 * part of the curve, and those are its own values.
 */
function cornerRun(seconds: number, rate: number, age: number, samples: number): number {
  const before = Math.floor(seconds * rate + 1e-9);
  if (before > age && before - age < samples) return before - age;
  if (before === age && samples > 1) return 1;
  return samples;
}

/** The longest attack of a note's envelopes, in seconds. */
function longestAttack(envelopes: readonly (Envelope | Dx7Envelope)[]): number {
  let longest = 0;
  for (const envelope of envelopes) longest = Math.max(longest, envelope.attack);
  return longest;
}

/** A copy of a patch, so later changes to the one sent do not reach it. */
function structuredCloneOf(patch: VoicePatch): VoicePatch {
  return JSON.parse(JSON.stringify(patch)) as VoicePatch;
}
