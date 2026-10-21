// The sandbox's saved settings, beside the theme: no DOM, and not in the
// store, the link or the sound. Only Screen glitch so far; the sandbox's
// settings menu will show it.

/** Where Screen glitch is saved, as "on" or "off". */
export const SCREEN_GLITCH_KEY = 'fmlab.screenGlitch';

/** Anything but "off", including nothing saved, is on. */
export function parseScreenGlitch(raw: unknown): boolean {
  return raw !== 'off';
}

/** The choice made this visit, for when storage is blocked. */
let chosen: boolean | null = null;

/** Whether the top screens glitch on a change. On when nothing is saved or storage is blocked. */
export function screenGlitchOn(): boolean {
  try {
    return parseScreenGlitch(localStorage.getItem(SCREEN_GLITCH_KEY));
  } catch {
    return chosen ?? true;
  }
}

export function saveScreenGlitch(on: boolean): void {
  chosen = on;
  try {
    localStorage.setItem(SCREEN_GLITCH_KEY, on ? 'on' : 'off');
  } catch {
    // Storage is blocked (private mode): the choice lasts for this visit.
  }
}
