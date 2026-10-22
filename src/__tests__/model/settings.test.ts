import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
  saveSettings,
  SETTINGS_KEY,
  stepSetting,
} from '../../model/settings';

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
      // The plate reverb, off (Jeremy, 2026-10-22).
      reverb: 'off',
      reverbDecay: 1.5,
      reverbMix: 25,
      reverbTone: 70,
    });
    expect(SETTINGS_KEY).toBe('fmlab.settings');
  });

  it('hold the reverb\'s numbers in range and to their steps; anything else is the default', () => {
    const parsed = (json: object) => parseSettings(JSON.stringify(json));
    expect(parsed({ reverb: 'on', reverbMix: 25.4, reverbTone: 300, reverbDecay: 3.04 })).toEqual({
      ...DEFAULT_SETTINGS,
      reverb: 'on',
      reverbMix: 25,
      reverbTone: 100,
      reverbDecay: 3,
    });
    expect(parsed({ reverb: 'loud', reverbMix: 'x', reverbTone: null, reverbDecay: -5 })).toEqual({
      ...DEFAULT_SETTINGS,
      reverbDecay: 0.2,
    });
    expect(parseSettings('{"reverbDecay":1e999}')).toEqual(DEFAULT_SETTINGS);
  });

  it('step a number line by one or ten, held at its ends, never drifting', () => {
    expect(stepSetting('reverbDecay', 1.5, 1)).toBe(1.6);
    expect(stepSetting('reverbDecay', 1.5, -10)).toBe(0.5);
    expect(stepSetting('reverbDecay', 0.3, -10)).toBe(0.2);
    expect(stepSetting('reverbDecay', 19.95, 10)).toBe(20);
    expect(stepSetting('reverbMix', 99, 10)).toBe(100);
    expect(stepSetting('reverbTone', 3, -10)).toBe(0);
    // A hundred tenths up from 0.2 lands on 10.2 exactly.
    let decay = 0.2;
    for (let i = 0; i < 100; i++) decay = stepSetting('reverbDecay', decay, 1);
    expect(decay).toBe(10.2);
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
