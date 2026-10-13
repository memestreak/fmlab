import {
  CARRIER_HZ,
  CARRIER_SEMITONES,
  clamp,
  createLabStore,
  DEFAULTS,
  hzToSemitones,
  INDEX,
  MOD_HZ,
  MOD_OCTAVES,
  modHzToOctaves,
  modulatorHz,
  octavesToModHz,
  patchOf,
  RATIO,
  semitonesToHz,
  VOLUME,
} from '../../model/lab';
import { nextTheme, parseTheme } from '../../model/theme';

describe('the lab store', () => {
  it('starts on the default patch, silent', () => {
    expect(createLabStore().get()).toEqual({
      chapter: 1,
      mode: 'pm',
      carrierHz: 220,
      ratio: 1,
      index: 2,
      modHz: 5,
      deviationHz: 20,
      showModulator: true,
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
  it('is the carrier times the ratio in pm', () => {
    expect(modulatorHz({ ...DEFAULTS, carrierHz: 220, ratio: 1 })).toBe(220);
    expect(modulatorHz({ ...DEFAULTS, carrierHz: 110, ratio: 3.5 })).toBe(385);
  });

  it('is the modulator slider itself in fm', () => {
    expect(modulatorHz({ ...DEFAULTS, mode: 'fm', modHz: 7, ratio: 3 })).toBe(7);
  });
});

describe('patchOf', () => {
  it('is the ratio and index as set, in pm', () => {
    const state = { ...DEFAULTS, ratio: 1.5, index: 3, modHz: 99, deviationHz: 99 };
    expect(patchOf(state)).toEqual({ ratio: 1.5, index: 3 });
  });

  it('works them out from Hz in fm', () => {
    const state = {
      ...DEFAULTS,
      mode: 'fm' as const,
      carrierHz: 220,
      modHz: 5,
      deviationHz: 20,
    };
    // 5 Hz against 220 Hz, and 20 Hz of deviation at 5 Hz.
    expect(patchOf(state).ratio).toBeCloseTo(5 / 220, 12);
    expect(patchOf(state).index).toBe(4);
  });

  it('gives a slower modulator a larger index at the same deviation', () => {
    const at = (modHz: number) =>
      patchOf({ ...DEFAULTS, mode: 'fm', modHz, deviationHz: 20 }).index;
    expect(at(0.5)).toBe(40);
    expect(at(200)).toBeCloseTo(0.1, 12);
  });
});

describe('the modulator slider scale', () => {
  it('spans 0.5 to 880 Hz', () => {
    expect(octavesToModHz(0)).toBe(MOD_HZ.min);
    expect(octavesToModHz(MOD_OCTAVES)).toBeCloseTo(MOD_HZ.max, 9);
  });

  it('doubles the rate every octave, and goes there and back', () => {
    expect(octavesToModHz(1)).toBe(1);
    expect(octavesToModHz(4)).toBe(8);
    for (const hz of [0.5, 5, 20, 440]) {
      expect(octavesToModHz(modHzToOctaves(hz))).toBeCloseTo(hz, 9);
    }
  });

  it('gives the vibrato range a good share of the slider', () => {
    // 0.5 to 20 Hz is about half of it.
    expect(modHzToOctaves(20) / MOD_OCTAVES).toBeGreaterThan(0.45);
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
