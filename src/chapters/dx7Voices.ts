import { WHEEL_DEPTHS } from '../dsp/dx7';
import { FACTORY_VOICES, type FactoryVoice } from './dx7Factory';
import type { ChapterPatch, Preset } from './types';

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

export const DX7_VOICES: Preset[] = FACTORY_VOICES.map((voice, i) => ({
  label: `${i + 1} ${voice.name}`,
  hint: factoryHint(voice),
  note: factoryNote(voice),
  patch: patchOf(voice),
}));

/** Where the sandbox opens: E.PIANO 1, voice 11. */
export const DX7_START: Partial<ChapterPatch> = patchOf(
  FACTORY_VOICES.find(voice => voice.name === 'E.PIANO 1')!,
);
