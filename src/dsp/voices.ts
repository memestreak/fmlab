/** MIDI note numbers: 69 is A4, 440 Hz. */
const A4 = 69;

/** A note's frequency in equal temperament, A4 = 440 Hz. */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - A4) / 12);
}

/** What choosing a voice needs to know of each. */
export interface VoiceState {
  /** The note it was last given, or null when it is free. */
  note: number | null;
  /** When that note was struck, on any clock. */
  struckAt: number;
  /** When it was let go, on the same clock; null while it is held. */
  releasedAt: number | null;
}

/**
 * Which voice (an index into `voices`) plays `note`, as a DX7 chooses: a
 * key already sounding strikes its own voice again; otherwise a free
 * voice; otherwise the voice let go longest ago; otherwise, every voice
 * being held, the one struck first.
 */
export function chooseVoice(voices: readonly VoiceState[], note: number): number {
  const own = voices.findIndex(voice => voice.note === note);
  if (own >= 0) return own;
  const free = voices.findIndex(voice => voice.note === null);
  if (free >= 0) return free;
  let chosen = -1;
  voices.forEach((voice, i) => {
    if (voice.releasedAt === null) return;
    const best = chosen < 0 ? Infinity : voices[chosen].releasedAt!;
    if (voice.releasedAt < best) chosen = i;
  });
  if (chosen >= 0) return chosen;
  voices.forEach((voice, i) => {
    if (chosen < 0 || voice.struckAt < voices[chosen].struckAt) chosen = i;
  });
  return chosen;
}
