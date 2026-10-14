// The chapter is in the URL's hash, "#2", so a chapter can be linked to and
// survives a reload. With no hash the site opens on the landing view. The
// sandbox also keeps its sound there, "#7?c=220&r=1.41&i=5", so a sound
// can be shared by its link.

import {
  CARRIER_HZ,
  clamp,
  hzToSemitones,
  INDEX,
  type LabState,
  RATIO,
  semitonesToHz,
} from '../model/lab';

/** The hash's parts: the chapter's number, and anything after a "?". */
const HASH = /^#(\d+)(?:\?(.*))?$/;

/**
 * The chapter a hash names, or `fallback` when it names none that exists:
 * no hash, not a number, or a number with no chapter.
 *
 * @param numbers the chapters that exist
 */
export function chapterFromHash(
  hash: string,
  numbers: readonly number[],
  fallback: number,
): number {
  const match = HASH.exec(hash);
  if (!match) return fallback;
  const number = Number(match[1]);
  return numbers.includes(number) ? number : fallback;
}

/** What follows the "?" in a hash, as parameters; empty if nothing does. */
export function paramsFromHash(hash: string): URLSearchParams {
  return new URLSearchParams(HASH.exec(hash)?.[2] ?? '');
}

export function hashForChapter(number: number, params?: string): string {
  return params ? `#${number}?${params}` : `#${number}`;
}

/**
 * Whether a hash is one the page should take out of the address bar: it
 * is there, but names no chapter, so the page is showing the landing view
 * under an address that claims otherwise.
 */
export function isStrayHash(hash: string, numbers: readonly number[]): boolean {
  if (hash === '' || hash === '#') return false;
  return chapterFromHash(hash, numbers, -1) === -1;
}

/** A number written as briefly as it can be to `places` decimals: 1.41, 220, 2.5. */
function brief(value: number, places: number): string {
  return String(Number(value.toFixed(places)));
}

/**
 * The parameters that carry a sandbox sound: the carrier in Hz, the ratio
 * and the index. Volume stays the listener's own, and is left out.
 */
export function soundParams(state: LabState): string {
  const params = new URLSearchParams({
    c: brief(state.carrierHz, 2),
    r: brief(state.ratio, 3),
    i: brief(state.index, 2),
  });
  return params.toString();
}

/**
 * The sound a link's parameters describe, as a patch: each one that is
 * there and a number, held inside its slider's range. The carrier is put
 * on the Carrier slider's nearest step, a quarter of a semitone, so a
 * hand-typed 221 Hz becomes a pitch the slider can show. Anything missing
 * or not a number is left out, to keep what the chapter starts with.
 */
export function soundFromParams(params: URLSearchParams): Partial<LabState> {
  const read = (key: string) => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  const patch: Partial<LabState> = {};
  const carrier = read('c');
  if (carrier !== null && carrier > 0) {
    const hz = clamp(carrier, CARRIER_HZ);
    patch.carrierHz = semitonesToHz(Math.round(hzToSemitones(hz) * 4) / 4);
  }
  const ratio = read('r');
  if (ratio !== null) patch.ratio = clamp(ratio, RATIO);
  const index = read('i');
  if (index !== null) patch.index = clamp(index, INDEX);
  return patch;
}
