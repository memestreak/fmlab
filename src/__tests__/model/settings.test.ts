import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings, SETTINGS_KEY } from '../../model/settings';

describe('the sandbox\'s settings', () => {
  it('default to today\'s behaviour', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      screenGlitch: 'on',
      motion: 'system',
      tips: 'on',
      zxHint: 'hover',
      noteNames: 'c',
      computerKeys: 'off',
      wheel: 'page',
    });
    expect(SETTINGS_KEY).toBe('fmlab.settings');
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

  it('come back as they were saved', () => {
    const items: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items[key] ?? null,
      setItem: (key: string, value: string) => {
        items[key] = value;
      },
    });
    const changed = { ...DEFAULT_SETTINGS, screenGlitch: 'off', zxHint: 'always', noteNames: 'all', wheel: 'reverse' } as const;
    saveSettings(changed);
    expect(loadSettings()).toEqual(changed);
    vi.unstubAllGlobals();
  });

  it('are the defaults when storage is blocked, and saving does not throw', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    vi.unstubAllGlobals();
  });
});
