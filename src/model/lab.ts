import { createStore, type Store } from './store';
import type { ThemeChoice } from './theme';

/** Everything the page shows and plays: one carrier, one modulator. */
export interface LabState {
  /** Carrier frequency in Hz. */
  carrierHz: number;
  /** Modulator frequency as a multiple of the carrier's. */
  ratio: number;
  /** Modulation index: the peak phase deviation, in radians. */
  index: number;
  /** Master gain, 0 to 1. */
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

export const DEFAULTS: LabState = {
  carrierHz: 220,
  ratio: 1,
  index: 2,
  // Low on purpose: FM gets bright, and loud, quickly.
  volume: 0.2,
  playing: false,
  theme: 'auto',
};

export function createLabStore(initial: Partial<LabState> = {}): LabStore {
  return createStore({ ...DEFAULTS, ...initial });
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
