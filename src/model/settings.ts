import { createStore, type Store } from './store';
import { THEME_CHOICES, type ThemeChoice } from './theme';

// The player's preferences (the Settings panel, ui/settingsPanel.ts): per
// browser, saved a section to a key (SETTING_SECTIONS), outside the lab's
// store, the link and the sound (the reverb is the voice's:
// dsp/plateReverb.ts's VoiceReverb). No DOM. The theme is among them,
// in General's Appearance, which the boot script in index.html reads
// before the first paint; the chapters' theme switch sets the same value.

export interface Settings {
  /** The chapters' theme: Auto follows the system (model/theme.ts). The synth is dark only. */
  theme: ThemeChoice;
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
export type NumberSetting = 'midiChannel';
/** The settings that are free text. */
export type TextSetting = 'midiInput';
export type ChoiceSetting = Exclude<keyof Settings, NumberSetting | TextSetting>;

/** A text setting's longest. */
export const MAX_TEXT_SETTING = 100;

/** Every number setting's range and step. */
export const SETTING_RANGES: Record<NumberSetting, { min: number; max: number; step: number }> = {
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
  theme: THEME_CHOICES,
  screenGlitch: ['on', 'off'],
  motion: ['system', 'still'],
  tips: ['on', 'off'],
  zxHint: ['hover', 'always', 'off'],
  noteNames: ['c', 'all', 'off'],
  computerKeys: ['off', 'on'],
  keyVelocity: [100, 64, 127],
  wheel: ['page', 'reverse'],
  midi: ['off', 'on'],
  bendRange: [2, 1, 3, 5, 7, 12],
  velocityCurve: ['normal', 'lightest', 'light', 'heavy', 'heaviest'],
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  screenGlitch: 'on',
  motion: 'system',
  tips: 'on',
  zxHint: 'hover',
  noteNames: 'c',
  computerKeys: 'off',
  keyVelocity: 100,
  wheel: 'page',
  midi: 'off',
  midiInput: '',
  midiChannel: 0,
  bendRange: 2,
  velocityCurve: 'normal',
};

/**
 * Where they are saved: one key a section, `fmlab.<page>.<section>`, each
 * holding its settings as JSON (the settings philosophy; Jeremy,
 * 2026-10-29). A setting's full name is its section's key and its own,
 * `fmlab.synth.midi.bendRange` (`settingName`).
 */
export const SETTING_SECTIONS = {
  'fmlab.general.appearance': ['theme', 'motion', 'tips'],
  'fmlab.synth.display': ['screenGlitch', 'zxHint', 'noteNames', 'computerKeys'],
  'fmlab.synth.keyboard': ['keyVelocity', 'wheel'],
  'fmlab.synth.midi': ['midi', 'midiInput', 'midiChannel', 'bendRange', 'velocityCurve'],
} as const satisfies Record<string, readonly (keyof Settings)[]>;

/** A section's storage key. */
export type SettingSection = keyof typeof SETTING_SECTIONS;

/** Every section's key, in the order the dialog lists them. */
export const SECTION_KEYS = Object.keys(SETTING_SECTIONS) as SettingSection[];

/** The section a setting is saved in. */
export function sectionOf(key: keyof Settings): SettingSection {
  return SECTION_KEYS.find(section => (SETTING_SECTIONS[section] as readonly string[]).includes(key))!;
}

/** A setting's full name, `fmlab.synth.midi.bendRange`. */
export const settingName = (key: keyof Settings) => `${sectionOf(key)}.${key}`;

/** One setting from a saved section's object: its value if it is one, else undefined. */
function readSetting<K extends keyof Settings>(key: K, value: unknown): Settings[K] | undefined {
  if (key in SETTING_CHOICES) {
    const choices = SETTING_CHOICES[key as ChoiceSetting] as readonly unknown[];
    return choices.includes(value) ? (value as Settings[K]) : undefined;
  }
  // A number: held in range and rounded to its step.
  if (key in SETTING_RANGES) {
    return typeof value === 'number' && Number.isFinite(value)
      ? (inRange(key as NumberSetting, value) as Settings[K])
      : undefined;
  }
  // A text: any string up to its longest.
  return typeof value === 'string' && value.length <= MAX_TEXT_SETTING ? (value as Settings[K]) : undefined;
}

/** The settings a section holds. */
export type SectionSettings<S extends SettingSection> = Pick<Settings, (typeof SETTING_SECTIONS)[S][number]>;

/**
 * A section's settings from its saved JSON: only its own, each checked,
 * anything missing, unknown or unreadable its default.
 */
export function parseSection<S extends SettingSection>(section: S, raw: string | null): SectionSettings<S> {
  let saved: unknown;
  try {
    saved = raw === null ? null : JSON.parse(raw);
  } catch {
    saved = null;
  }
  const object = typeof saved === 'object' && saved !== null && !Array.isArray(saved) ? (saved as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const key of SETTING_SECTIONS[section]) out[key] = readSetting(key, object[key]) ?? DEFAULT_SETTINGS[key];
  return out as SectionSettings<S>;
}

/** A section's settings as saved, as JSON. */
export function sectionJson(section: SettingSection, from: Settings): string {
  return JSON.stringify(Object.fromEntries(SETTING_SECTIONS[section].map(key => [key, from[key]])));
}

/** The saved settings, section by section; a section's defaults when it is missing or storage is blocked. */
export function loadSettings(): Settings {
  const loaded = { ...DEFAULT_SETTINGS };
  for (const section of SECTION_KEYS) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(section);
    } catch {
      // Storage is blocked (private mode): the defaults.
    }
    Object.assign(loaded, parseSection(section, raw));
  }
  return loaded;
}

/** Whether a save has failed this visit (said once in the console; the dialog may say it too). */
let saveFailed = false;
export const settingsSaveFailed = () => saveFailed;

/**
 * Saves the sections that differ from `before` (all of them without it).
 * A failure (storage blocked or full) is reported once, quietly, in the
 * console; the settings last for this visit, and nothing waits on it.
 */
export function saveSettings(now: Settings, before?: Settings): void {
  for (const section of SECTION_KEYS) {
    if (before && SETTING_SECTIONS[section].every(key => now[key] === before[key])) continue;
    try {
      localStorage.setItem(section, sectionJson(section, now));
    } catch (error) {
      if (!saveFailed) console.warn('fmlab: settings not saved; they last for this visit.', error);
      saveFailed = true;
    }
  }
}

/**
 * The settings as the page has them: changed by the dialog and by the
 * shortcuts that set the same values (the MIDI key, the chapters' theme
 * switch), read by whatever they govern, and saved as they change.
 */
export const settings: Store<Settings> = createStore(loadSettings());
settings.subscribe(saveSettings);
