import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSection,
  saveSettings,
  SECTION_KEYS,
  SETTING_SECTIONS,
  type Settings,
  settingName,
  settingsSaveFailed,
} from '../../model/settings';

/** Every section read from the same saved object, so one field's checks can be tested wherever it is saved. */
const parseSettings = (raw: string | null): Settings =>
  Object.assign({}, ...SECTION_KEYS.map(section => parseSection(section, raw))) as Settings;

/** A localStorage of a plain object, and what was written to it. */
function stubStorage(items: Record<string, string> = {}): { items: Record<string, string>; writes: string[] } {
  const writes: string[] = [];
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items[key] ?? null,
    setItem: (key: string, value: string) => {
      writes.push(key);
      items[key] = value;
    },
  });
  return { items, writes };
}

describe('the sandbox\'s settings', () => {
  it('default to today\'s behaviour', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      theme: 'auto',
      screenGlitch: 'on',
      motion: 'system',
      tips: 'on',
      zxHint: 'hover',
      noteNames: 'c',
      computerKeys: 'off',
      // The computer's and the screen's keys at velocity 100 (Jeremy, 2026-10-24).
      keyVelocity: 100,
      wheel: 'page',
      // MIDI In, off; every input, every channel, the wheel two semitones (Jeremy, 2026-10-23).
      midi: 'off',
      midiInput: '',
      midiChannel: 0,
      bendRange: 2,
      velocityCurve: 'normal',
    });
  });

  it('are saved a section to a key, fmlab.<page>.<section> (Jeremy, 2026-10-29)', () => {
    expect(SETTING_SECTIONS).toEqual({
      'fmlab.general.appearance': ['theme', 'motion', 'tips'],
      'fmlab.synth.display': ['screenGlitch', 'zxHint', 'noteNames', 'computerKeys'],
      'fmlab.synth.keyboard': ['keyVelocity', 'wheel'],
      'fmlab.synth.midi': ['midi', 'midiInput', 'midiChannel', 'bendRange', 'velocityCurve'],
    });
    // Every setting in exactly one section.
    const all = Object.values(SETTING_SECTIONS).flat().sort();
    expect(all).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    expect(settingName('bendRange')).toBe('fmlab.synth.midi.bendRange');
    expect(settingName('theme')).toBe('fmlab.general.appearance.theme');
  });

  it('read a section\'s own settings only', () => {
    const raw = JSON.stringify({ theme: 'dark', wheel: 'reverse', motion: 'still' });
    expect(parseSection('fmlab.general.appearance', raw)).toEqual({ theme: 'dark', motion: 'still', tips: 'on' });
    expect(parseSection('fmlab.synth.keyboard', raw)).toEqual({ keyVelocity: 100, wheel: 'reverse' });
  });

  it('hold a number in range and to its step; anything else is the default', () => {
    const parsed = (json: object) => parseSettings(JSON.stringify(json));
    expect(parsed({ midiChannel: 3.4 })).toEqual({ ...DEFAULT_SETTINGS, midiChannel: 3 });
    expect(parsed({ midiChannel: 40 })).toEqual({ ...DEFAULT_SETTINGS, midiChannel: 16 });
    expect(parsed({ midiChannel: 'x' })).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"midiChannel":1e999}')).toEqual(DEFAULT_SETTINGS);
  });

  it('no longer hold the reverb, which is the voice\'s (Jeremy, 2026-10-29)', () => {
    expect(parseSettings('{"reverb":"on","reverbDecay":3}')).toEqual(DEFAULT_SETTINGS);
    expect(Object.keys(DEFAULT_SETTINGS).some(key => key.startsWith('reverb'))).toBe(false);
  });

  it('fall back to the defaults on bad or partial JSON, field by field', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"on"')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"motion":"still","wheel":"sideways","noteNames":3,"extra":true}')).toEqual({
      ...DEFAULT_SETTINGS,
      motion: 'still',
    });
  });

  it('come back as they were saved, each under its section\'s key', () => {
    const { items } = stubStorage();
    const changed = {
      ...DEFAULT_SETTINGS,
      theme: 'light',
      screenGlitch: 'off',
      zxHint: 'always',
      noteNames: 'all',
      wheel: 'reverse',
      bendRange: 12,
    } as const;
    saveSettings(changed);
    expect(Object.keys(items).sort()).toEqual([...SECTION_KEYS].sort());
    expect(JSON.parse(items['fmlab.general.appearance'])).toEqual({ theme: 'light', motion: 'system', tips: 'on' });
    expect(JSON.parse(items['fmlab.synth.midi']).bendRange).toBe(12);
    expect(loadSettings()).toEqual(changed);
    vi.unstubAllGlobals();
  });

  it('save only the sections that changed', () => {
    const { writes } = stubStorage();
    saveSettings({ ...DEFAULT_SETTINGS, wheel: 'reverse' }, DEFAULT_SETTINGS);
    expect(writes).toEqual(['fmlab.synth.keyboard']);
    vi.unstubAllGlobals();
  });

  it('take a missing or broken section as its defaults, and keep the rest', () => {
    stubStorage({ 'fmlab.synth.keyboard': '{"wheel":"reverse"}', 'fmlab.synth.midi': 'not json' });
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, wheel: 'reverse' });
    vi.unstubAllGlobals();
  });

  it('are the defaults when storage is blocked, and saving does not throw', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    // Said once, quietly, however many saves fail.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(settingsSaveFailed()).toBe(true);
    warn.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keep the MIDI choices: any input name up to 100 characters, a channel in range, a listed bend range', () => {
    const parsed = (json: object) => parseSettings(JSON.stringify(json));
    // An input not connected now is kept: it may be plugged in later.
    expect(parsed({ midi: 'on', midiInput: 'KeyStep 37', midiChannel: 10, bendRange: 12 })).toEqual({
      ...DEFAULT_SETTINGS,
      midi: 'on',
      midiInput: 'KeyStep 37',
      midiChannel: 10,
      bendRange: 12,
    });
    expect(parsed({ midiChannel: 40 }).midiChannel).toBe(16);
    expect(parsed({ midiChannel: -3 }).midiChannel).toBe(0);
    expect(parsed({ midiChannel: 2.6 }).midiChannel).toBe(3);
    expect(parsed({ bendRange: 4 }).bendRange).toBe(2);
    expect(parsed({ bendRange: '12' }).bendRange).toBe(2);
    expect(parsed({ midi: 'yes' }).midi).toBe('off');
    expect(parsed({ midiInput: 'x'.repeat(101) }).midiInput).toBe('');
    expect(parsed({ midiInput: 'x'.repeat(100) }).midiInput).toBe('x'.repeat(100));
    expect(parsed({ midiInput: 7 }).midiInput).toBe('');
  });

  it('keep Key velocity and the Velocity curve to their choices', () => {
    const parsed = (json: object) => parseSettings(JSON.stringify(json));
    expect(parsed({ keyVelocity: 127, velocityCurve: 'heavy' })).toEqual({
      ...DEFAULT_SETTINGS,
      keyVelocity: 127,
      velocityCurve: 'heavy',
    });
    expect(parsed({ keyVelocity: 64 }).keyVelocity).toBe(64);
    expect(parsed({ keyVelocity: 90 }).keyVelocity).toBe(100);
    expect(parsed({ keyVelocity: '127' }).keyVelocity).toBe(100);
    expect(parsed({ velocityCurve: 'light' }).velocityCurve).toBe('light');
    expect(parsed({ velocityCurve: 'heaviest' }).velocityCurve).toBe('heaviest');
    expect(parsed({ velocityCurve: 'lightest' }).velocityCurve).toBe('lightest');
    expect(parsed({ velocityCurve: 'soft' }).velocityCurve).toBe('normal');
  });
});
