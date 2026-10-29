import { WHEEL_DEPTHS } from '../dsp/dx7';
import { DEFAULT_REVERB } from '../dsp/plateReverb';
import { FACTORY_VOICES, type FactoryVoice } from './dx7Factory';
import { FMLAB_VOICES } from './fmlabVoices';
import type { ChapterPatch, Preset, PresetBank } from './types';

// The sandbox's sounds to start from: the 32 voices of Yamaha's DX7
// factory set (ROM1A; factory voices © Yamaha), numbered as on the DX7,
// converted into the sandbox's units by
// scripts/dx7_voices.py (dx7Factory.ts). Close approximations: the
// sandbox plays everything they set that it has, and leaves out what it
// has not (velocity, fixed frequencies, transpose, an envelope ending
// above silence), which each hint names.

/** A factory voice as a preset's patch. */
function patchOf(voice: FactoryVoice): Partial<ChapterPatch> {
  return {
    algorithm: voice.algorithm,
    dxFeedback: voice.dxFeedback,
    dxOperators: voice.dxOperators,
    // The wheel's depths are not in a DX7 voice: every voice opens on the same.
    dxLfo: { ...voice.dxLfo, ...WHEEL_DEPTHS },
    dxPitchEnvelope: voice.dxPitchEnvelope,
    // Every voice starts dry (Jeremy, 2026-10-29); a DX7 voice has no reverb.
    dxReverb: DEFAULT_REVERB,
  };
}

/** What a preset's hint says: whose voice, and what it plays without. */
export function factoryHint(voice: FactoryVoice): string {
  const without = voice.missing.length > 0 ? `, without its ${list(voice.missing)}` : '';
  return `the DX7's factory ${voice.name}, a close approximation${without}`;
}

/** "a", "a and b", "a, b and c". */
function list(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** The line beside the menu: "approximate · no velocity, transpose". */
export function factoryNote(voice: FactoryVoice): string {
  const short = voice.missing.map(what => what.replace(/ \(.*\)$/, ''));
  return short.length > 0 ? `approximate · no ${short.join(', ')}` : 'approximate';
}

/** The credit for bank A, Yamaha's factory voices. */
export const FACTORY_CREDIT = 'DX7 factory voices © Yamaha';
/** Bank B's name: fmlab's own voices. */
export const FMLAB_CREDIT = 'fmlab voices';

/** Bank A: the DX7's factory voices, "A11 E.PIANO 1". */
export const DX7_VOICES: Preset[] = FACTORY_VOICES.map((voice, i) => ({
  label: `A${i + 1} ${voice.name}`,
  hint: factoryHint(voice),
  note: factoryNote(voice),
  patch: patchOf(voice),
  bank: 'A',
}));

/**
 * Bank B: fmlab's own 32 (fmlabVoices.ts), "B1 TINE PIANO". Written for
 * the sandbox, they play all they set: no "approximate", no note.
 */
export const FMLAB_PRESETS: Preset[] = FMLAB_VOICES.map((voice, i) => ({
  label: `B${i + 1} ${voice.name}`,
  hint: `fmlab's own ${voice.name}`,
  patch: patchOf(voice),
  bank: 'B',
}));

/** The sandbox's voices: bank A, then bank B. */
export const SANDBOX_VOICES: Preset[] = [...DX7_VOICES, ...FMLAB_PRESETS];

/** The sandbox's two banks; A opens on E.PIANO 1, B on TINE PIANO. */
export const SANDBOX_BANKS: readonly PresetBank[] = [
  { id: 'A', name: FACTORY_CREDIT, start: FACTORY_VOICES.findIndex(voice => voice.name === 'E.PIANO 1') },
  { id: 'B', name: FMLAB_CREDIT, start: DX7_VOICES.length },
];

/** Where the sandbox opens: E.PIANO 1, voice 11. */
export const DX7_START: Partial<ChapterPatch> = patchOf(
  FACTORY_VOICES.find(voice => voice.name === 'E.PIANO 1')!,
);
