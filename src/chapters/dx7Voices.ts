import { FACTORY_VOICES, type FactoryVoice } from './dx7Factory';
import type { ChapterPatch, Preset } from './types';

// The sandbox's sounds to start from: six of Yamaha's DX7 factory voices
// (ROM1A; factory voices © Yamaha), converted into the sandbox's units by
// scripts/dx7_voices.py (dx7Factory.ts). Close approximations: the
// sandbox plays everything they set that it has, and leaves out what it
// has not (velocity, vibrato and tremolo, the pitch envelope, fixed
// frequencies, transpose), which each hint names.

/** A factory voice as a preset's patch. */
function patchOf(voice: FactoryVoice): Partial<ChapterPatch> {
  return {
    algorithm: voice.algorithm,
    dxFeedback: voice.dxFeedback,
    dxOperators: voice.dxOperators,
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

export const DX7_VOICES: Preset[] = FACTORY_VOICES.map(voice => ({
  label: voice.name,
  hint: factoryHint(voice),
  patch: patchOf(voice),
}));

/** Where the sandbox opens: E.PIANO 1. */
export const DX7_START: Partial<ChapterPatch> = DX7_VOICES[0].patch;
