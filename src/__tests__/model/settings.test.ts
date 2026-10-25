import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
  saveSettings,
  SETTINGS_KEY,
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
      // The computer's and the screen's keys at velocity 100 (Jeremy, 2026-10-24).
      keyVelocity: 100,
      wheel: 'page',
      // The plate reverb, off (Jeremy, 2026-10-22).
      reverb: 'off',
      reverbDecay: 1.5,
      reverbMix: 25,
      reverbTone: 70,
      reverbPreDelay: 0,
      // MIDI In, off; every input, every channel, the wheel two semitones (Jeremy, 2026-10-23).
      midi: 'off',
      midiInput: '',
      midiChannel: 0,
      bendRange: 2,
      velocityCurve: 'normal',
      softestPress: 1,
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
    expect(parsed({ softestPress: 40 }).softestPress).toBe(40);
    expect(parsed({ softestPress: 35 }).softestPress).toBe(1);
    expect(parsed({ softestPress: '40' }).softestPress).toBe(1);
  });
});
