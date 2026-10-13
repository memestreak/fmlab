import {
  CARRIER_HZ,
  CARRIER_SEMITONES,
  clamp,
  createLabStore,
  DEFAULTS,
  hzToSemitones,
  INDEX,
  modulatorHz,
  RATIO,
  semitonesToHz,
  VOLUME,
} from '../../model/lab';
import { nextTheme, parseTheme } from '../../model/theme';

describe('the lab store', () => {
  it('starts on the default patch, silent', () => {
    expect(createLabStore().get()).toEqual({
      carrierHz: 220,
      ratio: 1,
      index: 2,
      volume: 0.2,
      playing: false,
      theme: 'auto',
    });
  });

  it('takes overrides', () => {
    const state = createLabStore({ theme: 'dark' }).get();
    expect(state.theme).toBe('dark');
    expect(state.carrierHz).toBe(220);
  });

  it('has its defaults inside its ranges', () => {
    const state = createLabStore().get();
    expect(clamp(state.carrierHz, CARRIER_HZ)).toBe(state.carrierHz);
    expect(clamp(state.ratio, RATIO)).toBe(state.ratio);
    expect(clamp(state.index, INDEX)).toBe(state.index);
  });
});

describe('modulatorHz', () => {
  it('is the carrier times the ratio', () => {
    expect(modulatorHz({ ...DEFAULTS, carrierHz: 220, ratio: 1 })).toBe(220);
    expect(modulatorHz({ ...DEFAULTS, carrierHz: 110, ratio: 3.5 })).toBe(385);
  });
});

describe('volume', () => {
  it('defaults low, well inside its range', () => {
    expect(DEFAULTS.volume).toBeLessThan(VOLUME.max / 2);
    expect(VOLUME.max).toBeLessThan(1);
  });
});

describe('clamp', () => {
  it('holds a value inside a range', () => {
    expect(clamp(-1, INDEX)).toBe(0);
    expect(clamp(11, INDEX)).toBe(10);
    expect(clamp(3.5, INDEX)).toBe(3.5);
  });
});

describe('the carrier slider scale', () => {
  it('spans four octaves, 55 to 880 Hz', () => {
    expect(CARRIER_SEMITONES).toBeCloseTo(48, 10);
    expect(semitonesToHz(0)).toBeCloseTo(55, 10);
    expect(semitonesToHz(CARRIER_SEMITONES)).toBeCloseTo(880, 10);
  });

  it('doubles the frequency every 12 semitones', () => {
    expect(semitonesToHz(12)).toBeCloseTo(110, 10);
    expect(semitonesToHz(24)).toBeCloseTo(220, 10);
  });

  it('goes there and back', () => {
    for (const hz of [55, 220, 261.63, 880]) {
      expect(semitonesToHz(hzToSemitones(hz))).toBeCloseTo(hz, 9);
    }
  });
});

describe('theme', () => {
  it('reads a saved choice and treats anything else as auto', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('auto')).toBe('auto');
    expect(parseTheme(null)).toBe('auto');
    expect(parseTheme('sepia')).toBe('auto');
  });

  it('cycles auto, light, dark and round again', () => {
    expect(nextTheme('auto')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('auto');
  });
});
