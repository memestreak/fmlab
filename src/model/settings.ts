import { createStore, type Store } from './store';

// The sandbox's settings (its Settings panel, ui/settingsPanel.ts): per
// browser, saved together under one key, outside the lab's store, the
// link and the sound. No DOM. The theme is a line of the panel too but
// keeps its own key and model (theme.ts), which the boot script reads
// before the first paint.

export interface Settings {
  /** The top screens' glitch on a tab or preset change (ui/screenGlitch.ts). */
  screenGlitch: 'on' | 'off';
  /** Still acts as prefers-reduced-motion across the sandbox; System follows the OS. */
  motion: 'system' | 'still';
  /** Off drops the sandbox's hover tips (native titles, terms' tips). */
  tips: 'on' | 'off';
  /** The keyboard's Z X hint: on hover or focus, always, or never. */
  zxHint: 'hover' | 'always' | 'off';
  /** The names on the piano's keys: every C, every white key, or none. */
  noteNames: 'c' | 'all' | 'off';
  /** The computer key that plays each piano key, drawn at its foot. */
  computerKeys: 'off' | 'on';
  /** A wheel's direction: as the page scrolls (positive deltaY the value below), or reversed. */
  wheel: 'page' | 'reverse';
}

/** Every setting's choices, the default first. */
export const SETTING_CHOICES: { [K in keyof Settings]: readonly Settings[K][] } = {
  screenGlitch: ['on', 'off'],
  motion: ['system', 'still'],
  tips: ['on', 'off'],
  zxHint: ['hover', 'always', 'off'],
  noteNames: ['c', 'all', 'off'],
  computerKeys: ['off', 'on'],
  wheel: ['page', 'reverse'],
};

export const DEFAULT_SETTINGS: Settings = {
  screenGlitch: 'on',
  motion: 'system',
  tips: 'on',
  zxHint: 'hover',
  noteNames: 'c',
  computerKeys: 'off',
  wheel: 'page',
};

/** Where they are saved, as JSON. */
export const SETTINGS_KEY = 'fmlab.settings';

/** Settings from saved JSON: anything missing, unknown or unreadable is its default. */
export function parseSettings(raw: string | null): Settings {
  let saved: unknown;
  try {
    saved = raw === null ? null : JSON.parse(raw);
  } catch {
    saved = null;
  }
  const settings = { ...DEFAULT_SETTINGS };
  if (typeof saved !== 'object' || saved === null) return settings;
  for (const key of Object.keys(SETTING_CHOICES) as (keyof Settings)[]) {
    const value = (saved as Record<string, unknown>)[key];
    if ((SETTING_CHOICES[key] as readonly unknown[]).includes(value)) {
      (settings as Record<keyof Settings, unknown>)[key] = value;
    }
  }
  return settings;
}

/** The saved settings; the defaults when storage is empty or blocked. */
export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage is blocked (private mode): they last for this visit.
  }
}

/** The settings as the page has them: changed by the panel, read by whatever they govern. */
export const settings: Store<Settings> = createStore(loadSettings());
