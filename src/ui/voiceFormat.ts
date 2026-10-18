// How the sandbox's DX7 voice writes its numbers: times, levels, cents and
// keys, the same in the table, the envelope view and for a screen reader.

import { SILENCE_DB } from '../dsp/dx7';
import { noteName } from './piano';

/** A time: "0 ms", "2 ms", "150 ms", "1.2 s", "12 s". */
export function formatTime(seconds: number): string {
  if (seconds < 0.0005) return '0 ms';
  if (seconds < 0.995) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 9.95) return `${seconds.toFixed(1)} s`;
  return `${Math.round(seconds)} s`;
}

/** A level: "0 dB", "-18 dB", or "silent" at the floor. */
export function formatDb(db: number): string {
  if (db <= SILENCE_DB) return 'silent';
  return `${Number(db.toFixed(1))} dB`;
}

/** Detune: "0", "+2", "-1.5". */
export function formatCents(cents: number): string {
  const brief = Number(cents.toFixed(1));
  return brief > 0 ? `+${brief}` : String(brief);
}

/** A key typed as a note name, "C3", "F♯2", "Bb4", "c#3", as a MIDI number. */
export function parseNote(text: string): number | undefined {
  const match = /^\s*([a-gA-G])\s*([#♯b♭]?)\s*(-?\d)\s*$/.exec(text);
  if (!match) return undefined;
  const [, letter, accidental, octave] = match;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[letter.toLowerCase()]!;
  const shift = accidental === '#' || accidental === '♯' ? 1 : accidental ? -1 : 0;
  return (Number(octave) + 1) * 12 + base + shift;
}

export { noteName };
