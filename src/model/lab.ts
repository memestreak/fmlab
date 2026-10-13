import { createStore, type Store } from './store';
import type { ThemeChoice } from './theme';

/**
 * How the modulator acts on the carrier. `pm` adds to its phase, which is
 * what the lab (and a DX7) does. `fm` moves its frequency, which only the
 * vibrato chapter uses.
 */
export type SynthMode = 'pm' | 'fm';

/** Everything the page shows and plays: one carrier, one modulator. */
export interface LabState {
  /** The chapter on screen, by its number. */
  chapter: number;
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
   * The sideband order (0 is the carrier, 1 the first pair, ...) being
   * pointed at or focused just now, in either linked figure; null for
   * none.
   */
  hover: number | null;
  /** The order held picked out by its chip until it is pressed again. */
  pinned: number | null;
  /**
   * "Show motion": animate the waveform figure, where it has a moving
   * view, even with no sound playing.
   */
  motion: boolean;
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

export const DEFAULTS: LabState = {
  chapter: 1,
  mode: 'pm',
  carrierHz: 220,
  ratio: 1,
  index: 2,
  modHz: 5,
  deviationHz: 20,
  showModulator: true,
  showBandwidth: false,
  realUnits: false,
  hover: null,
  pinned: null,
  motion: false,
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
export function patchOf(state: LabState): { ratio: number; index: number } {
  if (state.mode === 'pm') return { ratio: state.ratio, index: state.index };
  return {
    ratio: state.modHz / state.carrierHz,
    index: state.deviationHz / state.modHz,
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
