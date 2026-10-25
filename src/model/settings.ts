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
  /**
   * The velocity the computer's and the screen's keys strike at (Jeremy,
   * 2026-10-24): 100, as written, by default.
   */
  keyVelocity: 64 | 100 | 127;
  /** A wheel's direction: as the page scrolls (positive deltaY the value below), or reversed. */
  wheel: 'page' | 'reverse';
  /**
   * The plate reverb (dsp/plateReverb.ts; Jeremy, 2026-10-22): heard or
   * not. It and the four below are set on the Voice section's Reverb tab
   * (ui/reverbView.ts), not in the Settings panel.
   */
  reverb: 'off' | 'on';
  /** Its -60 dB time, in seconds. */
  reverbDecay: number;
  /** Its dry and wet balance, 0 (dry only) to 100 (wet only). */
  reverbMix: number;
  /** Its tail's brightness, 0 (darkest) to 100 (brightest). */
  reverbTone: number;
  /** How long after the sound its tail starts, in ms (Jeremy, 2026-10-22). */
  reverbPreDelay: number;
  /**
   * MIDI In (ui/midi.ts; Jeremy, 2026-10-23): on or off, set by the
   * keyboard panel's In key, not a Settings line. On, the page asks for
   * MIDI again on load.
   */
  midi: 'off' | 'on';
  /** The input it listens to, by name: '' for all of them. */
  midiInput: string;
  /** The channel it listens to: 0 for all (as a DX7 in Omni), or 1 to 16. */
  midiChannel: number;
  /** How far the pitch wheel bends, in semitones each way. */
  bendRange: 1 | 2 | 3 | 5 | 7 | 12;
  /**
   * How a MIDI key's velocity is mapped before the voice hears it
   * (`curveVelocity`): Lightest and Light are easier to play loud, Heavy
   * and Heaviest harder.
   */
  velocityCurve: 'lightest' | 'light' | 'normal' | 'heavy' | 'heaviest';
}

/** The settings that are numbers, each in a range; the rest are choices. */
export type NumberSetting = 'reverbDecay' | 'reverbMix' | 'reverbTone' | 'reverbPreDelay' | 'midiChannel';
/** The settings that are free text. */
export type TextSetting = 'midiInput';
export type ChoiceSetting = Exclude<keyof Settings, NumberSetting | TextSetting>;

/** A text setting's longest. */
export const MAX_TEXT_SETTING = 100;

/** Every number setting's range and step. */
export const SETTING_RANGES: Record<NumberSetting, { min: number; max: number; step: number }> = {
  reverbDecay: { min: 0.2, max: 20, step: 0.1 },
  reverbMix: { min: 0, max: 100, step: 1 },
  reverbTone: { min: 0, max: 100, step: 1 },
  reverbPreDelay: { min: 0, max: 500, step: 1 },
  midiChannel: { min: 0, max: 16, step: 1 },
};

/** A number setting's value held in its range and rounded to its step. */
export function inRange(key: NumberSetting, value: number): number {
  const { min, max, step } = SETTING_RANGES[key];
  const steps = Math.round((Math.min(max, Math.max(min, value)) - min) / step);
  // To the step's own decimals, so 0.1 steps do not drift (1.5000000000000002).
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Number((min + steps * step).toFixed(decimals));
}

/** Every choice setting's choices, the default first. */
export const SETTING_CHOICES: { [K in ChoiceSetting]: readonly Settings[K][] } = {
  screenGlitch: ['on', 'off'],
  motion: ['system', 'still'],
  tips: ['on', 'off'],
  zxHint: ['hover', 'always', 'off'],
  noteNames: ['c', 'all', 'off'],
  computerKeys: ['off', 'on'],
  keyVelocity: [100, 64, 127],
  wheel: ['page', 'reverse'],
  reverb: ['off', 'on'],
  midi: ['off', 'on'],
  bendRange: [2, 1, 3, 5, 7, 12],
  velocityCurve: ['normal', 'lightest', 'light', 'heavy', 'heaviest'],
};

export const DEFAULT_SETTINGS: Settings = {
  screenGlitch: 'on',
  motion: 'system',
  tips: 'on',
  zxHint: 'hover',
  noteNames: 'c',
  computerKeys: 'off',
  keyVelocity: 100,
  wheel: 'page',
  reverb: 'off',
  reverbDecay: 1.5,
  reverbMix: 25,
  reverbTone: 70,
  reverbPreDelay: 0,
  midi: 'off',
  midiInput: '',
  midiChannel: 0,
  bendRange: 2,
  velocityCurve: 'normal',
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
  for (const key of Object.keys(SETTING_CHOICES) as ChoiceSetting[]) {
    const value = (saved as Record<string, unknown>)[key];
    if ((SETTING_CHOICES[key] as readonly unknown[]).includes(value)) {
      (settings as Record<keyof Settings, unknown>)[key] = value;
    }
  }
  // A number: held in range and rounded to its step; anything else the default.
  for (const key of Object.keys(SETTING_RANGES) as NumberSetting[]) {
    const value = (saved as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) settings[key] = inRange(key, value);
  }
  // A text: any string up to its longest; anything else the default.
  const input = (saved as Record<string, unknown>).midiInput;
  if (typeof input === 'string' && input.length <= MAX_TEXT_SETTING) settings.midiInput = input;
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
