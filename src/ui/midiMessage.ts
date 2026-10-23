// A MIDI message as the sandbox hears it (ui/midi.ts; Jeremy, 2026-10-23):
// pure, a function of its bytes and the Channel setting, for the tests.

/** What a message asks for; null for anything the sandbox ignores. */
export type MidiEvent =
  /** A key down; its velocity carried, not yet heard. */
  | { type: 'noteOn'; note: number; velocity: number }
  | { type: 'noteOff'; note: number }
  /** The sustain pedal (CC64). */
  | { type: 'pedal'; down: boolean }
  /** The mod wheel (CC1), 0 to 1. */
  | { type: 'wheel'; amount: number }
  /** All sound or all notes off (CC120, CC123): as Stop. */
  | { type: 'allOff' }
  /** The pitch wheel, -1 to 1. */
  | { type: 'bend'; amount: number };

/** The keys the sandbox plays: A0 to C8, a piano's. */
export const MIDI_NOTES = { min: 21, max: 108 };

/** As the wheel settles an amount: 0 to 1, in tenths of a percent. */
const settle = (amount: number) => Math.round(Math.min(1, Math.max(0, amount)) * 1000) / 1000;

/**
 * What `data` asks for, on `channel` (0 for every channel, or 1 to 16):
 * note on and off (on at velocity 0 is off), A0 to C8 only; the sustain
 * pedal (64 and over down); the mod wheel (CC1, its LSB ignored); all
 * off (CC120, CC123); and pitch bend (14 bits about 8192, to -1 and 1).
 * System messages and everything else are ignored.
 */
export function parseMidi(data: ArrayLike<number>, channel: number): MidiEvent | null {
  if (data.length < 1) return null;
  const status = data[0];
  const kind = status & 0xf0;
  // System messages (clock, active sensing, SysEx) are not a channel's.
  if (kind === 0xf0 || status < 0x80) return null;
  if (channel !== 0 && (status & 0x0f) + 1 !== channel) return null;
  const a = data[1] ?? 0;
  const b = data[2] ?? 0;
  const inRange = (note: number) => note >= MIDI_NOTES.min && note <= MIDI_NOTES.max;
  if (kind === 0x90 || kind === 0x80) {
    if (!inRange(a)) return null;
    return kind === 0x90 && b > 0 ? { type: 'noteOn', note: a, velocity: b } : { type: 'noteOff', note: a };
  }
  if (kind === 0xb0) {
    if (a === 64) return { type: 'pedal', down: b >= 64 };
    if (a === 1) return { type: 'wheel', amount: settle(b / 127) };
    if (a === 120 || a === 123) return { type: 'allOff' };
    return null;
  }
  if (kind === 0xe0) {
    const value = (b << 7) | a;
    const offset = value - 8192;
    return { type: 'bend', amount: offset < 0 ? offset / 8192 : offset / 8191 };
  }
  return null;
}
