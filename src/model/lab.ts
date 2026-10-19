import type { ViewId } from '../chapters/outline';
import { type Envelope, envelopeAt } from '../dsp/envelope';
import {
  dbToAmp,
  dx7EnvelopeAt,
  type Dx7Lfo,
  type Dx7Note,
  dx7Note,
  type Dx7Operator,
  dx7ReleaseSeconds,
  HELD_LFO,
  heldOperator,
  keyOf,
  levelAtKey,
} from '../dsp/dx7';
import { noteHold, type Operator, OPERATOR_RELEASE, operatorEnvelope } from '../dsp/operators';
import { createStore, type Store } from './store';
import type { ThemeChoice } from './theme';

/**
 * How the sound is made. `pm`: one modulator added to one carrier's phase,
 * as the lab (and a DX7) does. `fm`: the modulator moves the carrier's
 * frequency, which only the vibrato chapter uses. `ops`: six operators
 * wired by one of the DX7's algorithms (Operators and algorithms, and
 * the sandbox).
 */
export type SynthMode = 'pm' | 'fm' | 'ops';

/** The sandbox's operator panel's tabs: the envelope, or across the keyboard. */
export type VoiceTab = 'envelope' | 'keys';

/** Everything the page shows and plays: one carrier, one modulator. */
export interface LabState {
  /** What is on screen: a section, the landing view or the glossary. */
  chapter: ViewId;
  mode: SynthMode;
  /** Carrier frequency in Hz. */
  carrierHz: number;
  /** `pm`: modulator frequency as a multiple of the carrier's. */
  ratio: number;
  /** `pm`: modulation index, the peak phase deviation in radians. */
  index: number;
  /** `fm`: modulator frequency in Hz. */
  modHz: number;
  /** `fm`: how far the carrier's frequency is pushed each way, in Hz. */
  deviationHz: number;
  /** Whether the waveform figure draws the modulator behind the output. */
  showModulator: boolean;
  /** Whether the spectrum figure brackets the band Carson's rule gives. */
  showBandwidth: boolean;
  /**
   * Whether the figures' x axes are fixed in real units, ms and Hz, where
   * otherwise they are in carrier cycles and multiples of the carrier.
   * For where the carrier's frequency is itself the lesson: on fixed axes
   * a higher carrier is more waves and a stem further right, where on
   * carrier axes nothing would move but the small print.
   */
  realUnits: boolean;
  /**
   * Whether the spectrum figure rules a line at every whole multiple of
   * the carrier, to show which partials are harmonics and which fall
   * between.
   */
  showHarmonics: boolean;
  /**
   * Whether the chapter plays single notes shaped by the envelope, where
   * otherwise Play holds one steady sound.
   */
  noteMode: boolean;
  /** The envelope's attack, decay and release in seconds; see dsp/envelope. */
  attack: number;
  decay: number;
  /** The envelope's sustain level, 0 to 1. */
  sustain: number;
  release: number;
  /** Seconds a note is held before it is let go. Set by presets only. */
  hold: number;
  /**
   * Whether the envelope shapes the index as well as the loudness. Off,
   * the index stays at `index` for the whole note.
   */
  indexFollows: boolean;
  /**
   * `ops`: the notes held down on the keyboard (MIDI numbers), in the
   * order they were struck. Each sounds for as long as it is held; the
   * audio engine strikes and lets go as the list changes.
   */
  held: number[];
  /**
   * Counts the notes asked for by Play note or the space bar. The audio
   * engine plays one per change, held for `noteHold` and then let go.
   */
  notes: number;
  /** Counts the notes stopped early. The audio engine silences one per change. */
  stops: number;
  /**
   * When the last note started, in seconds on the page's clock
   * (performance.now), for the figures' playhead. Null before the first.
   */
  noteStartedAt: number | null;
  /**
   * How long that note lasts, in seconds, fixed when it started. A patch
   * changed afterwards (a preset with longer decays, say) does not make a
   * note already played, or already over, any longer. For a key still
   * held, Infinity: its length is known once it is let go (then the time
   * it was held plus the release).
   */
  noteLength: number;
  /**
   * `ops`: how long the last note is held before it is let go, in seconds:
   * Infinity while its key is down. Its envelopes, as the figures draw
   * them, are let go then.
   */
  noteHold: number;
  /**
   * The sideband order (0 is the carrier, 1 the first pair, ...) being
   * pointed at or focused just now, in either linked figure; null for
   * none.
   */
  hover: number | null;
  /** The order held picked out by its chip until it is pressed again. */
  pinned: number | null;
  /**
   * `ops`: the operator (0 to 5) pointed at or focused just now, in the
   * Operators table or the wiring diagram, which both pick it out; null
   * for none.
   */
  hoverOp: number | null;
  /** `ops`: which of the DX7's 32 algorithms wires the operators. */
  algorithm: number;
  /** `ops`: the six operators, OP1 first. */
  operators: Operator[];
  /** `ops`: how much the algorithm's feedback loop feeds back, in radians. */
  feedback: number;
  /**
   * `ops`: which operators play. `basic` is Operators and algorithms'
   * (`operators`, `feedback`: ratio, level and one decay); `dx7` is the
   * sandbox's DX7 voice (`dxOperators`, `dxFeedback`; dsp/dx7.ts).
   */
  voiceModel: 'basic' | 'dx7';
  /** `dx7`: the six operators, OP1 first. */
  dxOperators: Dx7Operator[];
  /** `dx7`: feedback in radians on the source's own output, 0 to 2π. */
  dxFeedback: number;
  /** `dx7`: the voice's LFO, its vibrato and tremolo (dsp/lfo.ts). */
  dxLfo: Dx7Lfo;
  /**
   * `dx7`: the operator selected in the table, whose envelope view is
   * open. One always is: OP1 when the sandbox opens.
   */
  selectedOp: number;
  /**
   * `dx7`: which tab of the selected operator's panel is showing, its
   * envelope or its level across the keyboard. It stays as it is when
   * another operator is selected.
   */
  voiceTab: VoiceTab;
  /**
   * Chapter 9: phase and frequency modulation side by side, both set by
   * `ratio` and `index`. `mode` says which is heard.
   */
  compare: boolean;
  /** Master gain. */
  volume: number;
  /** Whether sound is wanted. The audio engine follows it. */
  playing: boolean;
  theme: ThemeChoice;
}

export type LabStore = Store<LabState>;

export interface Range {
  min: number;
  max: number;
}

export const CARRIER_HZ: Range = { min: 55, max: 880 };
export const RATIO: Range = { min: 0.25, max: 8 };
export const INDEX: Range = { min: 0, max: 10 };
/** From a slow vibrato to well into the audio range. */
export const MOD_HZ: Range = { min: 0.5, max: 880 };
export const DEVIATION_HZ: Range = { min: 0, max: 200 };
/** The top is half of full scale: loud enough, and clear of the limiter. */
export const VOLUME: Range = { min: 0, max: 0.5 };
/** An operator's ratio, level and decay time, and the feedback. */
export const OP_RATIO: Range = { min: 0.5, max: 16 };
export const OP_LEVEL: Range = { min: 0, max: 1 };
export const OP_DECAY: Range = { min: 0, max: 6 };
export const FEEDBACK: Range = { min: 0, max: 2 };
/** Never quite 0: a note that starts in no time at all starts with a click. */
export const ATTACK: Range = { min: 0.005, max: 1 };
export const DECAY: Range = { min: 0.01, max: 5 };
export const SUSTAIN: Range = { min: 0, max: 1 };
export const RELEASE: Range = { min: 0.01, max: 5 };

export const DEFAULTS: LabState = {
  chapter: 'sine',
  mode: 'pm',
  carrierHz: 220,
  ratio: 1,
  index: 2,
  modHz: 5,
  deviationHz: 20,
  showModulator: true,
  showBandwidth: false,
  realUnits: false,
  showHarmonics: false,
  noteMode: false,
  attack: 0.08,
  decay: 0.15,
  sustain: 0.7,
  release: 0.2,
  hold: 0.6,
  indexFollows: true,
  held: [],
  notes: 0,
  stops: 0,
  noteStartedAt: null,
  noteLength: 0,
  noteHold: Infinity,
  hover: null,
  hoverOp: null,
  pinned: null,
  algorithm: 1,
  operators: [
    { ratio: 1, level: 1, decay: 0 },
    { ratio: 1, level: 0.3, decay: 0 },
    { ratio: 1, level: 1, decay: 0 },
    { ratio: 1, level: 0.3, decay: 0 },
    { ratio: 1, level: 0.2, decay: 0 },
    { ratio: 1, level: 0.2, decay: 0 },
  ],
  feedback: 0,
  voiceModel: 'basic',
  dxOperators: [
    heldOperator(1, 0),
    heldOperator(1, -18.5),
    heldOperator(1, 0),
    heldOperator(1, -18.5),
    heldOperator(1, -22),
    heldOperator(1, -22),
  ],
  dxFeedback: 0,
  dxLfo: HELD_LFO,
  selectedOp: 0,
  voiceTab: 'envelope',
  compare: false,
  // Low on purpose: FM gets bright, and loud, quickly.
  volume: 0.2,
  playing: false,
  theme: 'auto',
};

export function createLabStore(initial: Partial<LabState> = {}): LabStore {
  return createStore({ ...DEFAULTS, ...initial });
}

/**
 * The patch as a ratio and an index, whichever mode it is set in. The
 * figures and the spectrum maths work in these: in `fm` the ratio is the
 * modulator's Hz over the carrier's, and the index is the deviation over
 * the modulator's Hz, so a slower modulator means a larger index.
 */
/**
 * Chapter 9's patch as phase modulation: ratio and index as set. The same
 * whichever is being heard.
 */
export function asPm(state: LabState): LabState {
  return { ...state, mode: 'pm' };
}

/**
 * Chapter 9's patch as true frequency modulation, matched to the phase
 * modulation at a ratio of 1: the modulator at `ratio` times the carrier,
 * pushing the carrier's frequency by `index` times the carrier's. So its
 * index, deviation over modulator, is index / ratio: the same as phase
 * modulation's at ratio 1, larger below it and smaller above.
 */
export function asFm(state: LabState): LabState {
  return {
    ...state,
    mode: 'fm',
    modHz: state.ratio * state.carrierHz,
    deviationHz: state.index * state.carrierHz,
  };
}

export function patchOf(state: LabState): { ratio: number; index: number } {
  if (state.mode === 'pm') return { ratio: state.ratio, index: state.index };
  return {
    ratio: state.modHz / state.carrierHz,
    index: state.deviationHz / state.modHz,
  };
}

/**
 * The state's envelope, as dsp/envelope takes it. For six operators, each
 * has its own; this is the envelope of the note as a whole, held for as
 * long as the slowest operator needs and let go together, which is what
 * the note's length and the playhead go by.
 */
export function envelopeOf(state: LabState): Envelope {
  if (state.mode === 'ops') {
    const hold = noteHold(state.operators);
    return operatorEnvelope({ ratio: 1, level: 1, decay: 0 }, hold);
  }
  const { attack, decay, sustain, release, hold } = state;
  return { attack, decay, sustain, release, hold };
}

/**
 * Each operator's level `time` seconds into the last note struck: its
 * level shaped by its own envelope, held for as long as that note is (for
 * ever, while its key is down). Before or after a note, as set.
 */
export function operatorLevelsAt(state: LabState, time: number | undefined): number[] {
  const into = noteProgress(state, time);
  if (state.voiceModel === 'dx7') {
    // How loud each is, 0 to 1: its level at the key, by its envelope.
    const key = keyOf(state.carrierHz);
    const { envelopes } = dx7NoteOf(state);
    return state.dxOperators.map((op, i) => {
      const db = levelAtKey(op, key);
      if (db === null) return 0;
      return dbToAmp(db) * (into === null ? 1 : dx7EnvelopeAt(envelopes[i], into, state.noteHold));
    });
  }
  if (into === null) return state.operators.map(op => op.level);
  return state.operators.map(op => op.level * envelopeAt(operatorEnvelope(op, state.noteHold), into));
}

/** `dx7`: a note of the voice as set, at the carrier's pitch. */
export function dx7NoteOf(state: LabState): Dx7Note {
  return dx7Note(state.algorithm, state.dxOperators, state.dxFeedback, keyOf(state.carrierHz));
}

/**
 * `dx7`: each operator's level as the kernel takes it `time` seconds
 * into the last note (or as set, when none is sounding).
 */
export function dx7KernelLevelsAt(state: LabState, time: number | undefined): number[] {
  const into = noteProgress(state, time);
  const note = dx7NoteOf(state);
  return Array.from(note.gains, (gain, op) =>
    into === null ? gain : gain * dx7EnvelopeAt(note.envelopes[op], into, state.noteHold),
  );
}

/** How long the operators take to fall silent once a note is let go. */
export function releaseSecondsOf(state: LabState): number {
  return state.voiceModel === 'dx7' ? dx7ReleaseSeconds(state.dxOperators) : OPERATOR_RELEASE;
}

/**
 * The index `time` seconds into a note: the slider's index shaped by the
 * envelope, or the slider's index throughout when it does not follow.
 */
export function indexAtTime(state: LabState, time: number): number {
  return state.indexFollows
    ? state.index * envelopeAt(envelopeOf(state), time)
    : state.index;
}

/**
 * How many seconds into the last note the moment `time` is, on the page's
 * clock; null when no note is sounding then (none yet, not started, or
 * over).
 */
/**
 * Whether the last note is still sounding at `time`, in seconds on the
 * page's clock: asked for and not yet over. That includes the instant
 * between asking and its start, a few milliseconds later.
 */
export function noteSounding(state: LabState, time: number): boolean {
  if (state.noteStartedAt === null) return false;
  return time <= state.noteStartedAt + state.noteLength;
}

export function noteProgress(
  state: LabState,
  time: number | undefined,
): number | null {
  if (time === undefined || state.noteStartedAt === null) return null;
  const into = time - state.noteStartedAt;
  if (into < 0 || into > state.noteLength) return null;
  return into;
}

/**
 * What a figure should draw of a patch at a moment: its index, and how
 * loud it is, 0 to 1. Outside `noteMode`, and whenever no note is
 * sounding, that is the patch as set and at full height. While a note
 * sounds it is the note at that moment, so the waveform and spectrum
 * move with what is heard.
 */
export function momentOf(
  state: LabState,
  time: number | undefined,
): { index: number; level: number } {
  const { index } = patchOf(state);
  const into = state.noteMode ? noteProgress(state, time) : null;
  if (into === null) return { index, level: 1 };
  return {
    index: indexAtTime(state, into),
    level: envelopeAt(envelopeOf(state), into),
  };
}

/**
 * The sideband order the linked figures should pick out: the one under
 * the pointer or focus if there is one, otherwise the pinned one.
 */
export function highlightOf(state: LabState): number | null {
  return state.hover ?? state.pinned;
}

/**
 * The band Carson's rule says holds nearly all (about 98%) of the power,
 * in carrier units: index + 1 modulator frequencies each side of the
 * carrier. A lower edge that would fall below zero stops there; what lies
 * beyond has folded back into the band.
 */
export function carsonBand(
  ratio: number,
  index: number,
): { low: number; high: number } {
  const reach = (index + 1) * ratio;
  return { low: Math.max(0, 1 - reach), high: 1 + reach };
}

/** The modulator's frequency in Hz. */
export function modulatorHz(state: LabState): number {
  return state.mode === 'pm' ? state.carrierHz * state.ratio : state.modHz;
}

export function clamp(value: number, { min, max }: Range): number {
  return Math.min(max, Math.max(min, value));
}

/*
 * The carrier slider works in semitones above the bottom of its range, so
 * equal movements are equal musical intervals (a log scale) and every step
 * lands on a pitch.
 */

/** The carrier slider's top: 55 to 880 Hz is four octaves. */
export const CARRIER_SEMITONES = 12 * Math.log2(CARRIER_HZ.max / CARRIER_HZ.min);

export function semitonesToHz(semitones: number): number {
  return CARRIER_HZ.min * 2 ** (semitones / 12);
}

export function hzToSemitones(hz: number): number {
  return 12 * Math.log2(hz / CARRIER_HZ.min);
}

/*
 * The modulator's Hz slider is logarithmic too, in octaves above the
 * bottom of its range: the sweep from vibrato to tone covers three powers
 * of ten, and the interesting part is the low end.
 */

/** The modulator slider's top: 0.5 to 880 Hz is nearly eleven octaves. */
export const MOD_OCTAVES = Math.log2(MOD_HZ.max / MOD_HZ.min);

export function octavesToModHz(octaves: number): number {
  return MOD_HZ.min * 2 ** octaves;
}

export function modHzToOctaves(hz: number): number {
  return Math.log2(hz / MOD_HZ.min);
}
