import { algorithm } from './algorithms';
import { type Envelope, envelopeAt } from './envelope';
import { kernelLevels, type Operator, operatorEnvelope } from './operators';
import { type Algorithm, MAX_OPERATORS, PmKernel } from './pmKernel';
import { chooseVoice, type VoiceState } from './voices';

/** How many notes sound at once. The DX7 has 16. */
export const VOICES = 8;
/** A voice taken for a new note is faded out over this long first: no click. */
export const STEAL_SECONDS = 0.005;
/** A voice is free once every carrier is below this, -90 dB. */
export const SILENT = 10 ** (-90 / 20);

/** What every note is struck with: the six operators and their wiring. */
export interface VoicePatch {
  algorithm: number;
  feedback: number;
  operators: readonly Operator[];
}

/** What the main thread tells the pool, over the worklet's port. */
export type VoiceMessage =
  | { type: 'patch'; patch: VoicePatch }
  /** `hold`: seconds until the note lets itself go; Infinity until noteOff. */
  | { type: 'noteOn'; note: number; hz: number; hold: number }
  | { type: 'noteOff'; note: number }
  /** Everything silenced at once, faded over STEAL_SECONDS. */
  | { type: 'allOff' };

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
 * audio thread. A note takes up the patch as it was when struck.
 */
export class VoicePool {
  private readonly voices: Voice[];
  private readonly fadeSamples: number;
  private patch: VoicePatch = { algorithm: 1, feedback: 0, operators: [] };
  /** Samples rendered: the clock voices are chosen by. */
  private now = 0;

  constructor(
    count: number,
    private readonly sampleRate: number,
    lockSamples: number,
  ) {
    this.voices = Array.from({ length: count }, () => new Voice(lockSamples));
    this.fadeSamples = Math.max(1, Math.round(STEAL_SECONDS * sampleRate));
  }

  handle(message: VoiceMessage): void {
    if (message.type === 'patch') this.setPatch(message.patch);
    else if (message.type === 'noteOn') this.noteOn(message.note, message.hz, message.hold);
    else if (message.type === 'noteOff') this.noteOff(message.note);
    else this.allOff();
  }

  setPatch(patch: VoicePatch): void {
    this.patch = { ...patch, operators: patch.operators.map(op => ({ ...op })) };
  }

  /** Strikes `note` at `hz`; it lets itself go after `hold` seconds. */
  noteOn(note: number, hz: number, hold = Infinity): void {
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

  /** How many voices are sounding. */
  get active(): number {
    return this.voices.filter(voice => voice.sounding).length;
  }

  /** Fills `out` with the sum of every voice. */
  render(out: Float32Array): void {
    const { voices, sampleRate } = this;
    for (let i = 0; i < out.length; i++) {
      let sample = 0;
      for (const voice of voices) {
        if (voice.sounding) sample += this.tick(voice, sampleRate);
      }
      out[i] = sample;
      this.now++;
    }
    for (const voice of voices) this.settle(voice);
  }

  /** One voice's next sample. */
  private tick(voice: Voice, sampleRate: number): number {
    const time = voice.age / sampleRate;
    for (let op = 0; op < MAX_OPERATORS; op++) {
      voice.heard[op] = voice.levels[op] * envelopeAt(voice.envelopes[op], time);
    }
    let sample = voice.kernel.tick(
      voice.baseFreq,
      voice.ratios,
      kernelLevels(voice.alg, voice.heard, voice.scaled),
      voice.feedback,
    );
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
   * After each block: a note that lets itself go does so, and a voice
   * whose carriers have all died away is free.
   */
  private settle(voice: Voice): void {
    if (!voice.sounding || voice.fadeLeft > 0) return;
    const time = voice.age / this.sampleRate;
    const hold = voice.envelopes[0]?.hold ?? Infinity;
    if (voice.releasedAt === null && time >= hold) voice.releasedAt = this.now;
    const attack = Math.max(...voice.envelopes.map(envelope => envelope.attack));
    if (time <= attack) return;
    const silent = voice.alg.carriers.every(
      op => envelopeAt(voice.envelopes[op], time) < SILENT,
    );
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
    voice.feedback = patch.feedback;
    voice.baseFreq = hz / this.sampleRate;
    voice.operators = patch.operators;
    for (let op = 0; op < MAX_OPERATORS; op++) {
      voice.ratios[op] = patch.operators[op]?.ratio ?? 1;
      voice.levels[op] = patch.operators[op]?.level ?? 0;
    }
    voice.envelopes = this.envelopesFor(patch.operators, hold);
    voice.age = 0;
    voice.fadeLeft = 0;
    voice.sounding = true;
  }

  /** Lets a sounding voice go now. */
  private letGo(voice: Voice): void {
    if (!voice.sounding) return;
    voice.envelopes = this.envelopesFor(voice.operators, voice.age / this.sampleRate);
  }

  private envelopesFor(operators: readonly Operator[], hold: number): Envelope[] {
    return Array.from({ length: MAX_OPERATORS }, (_, op) =>
      operatorEnvelope(operators[op] ?? { ratio: 1, level: 0, decay: 0 }, hold),
    );
  }
}
