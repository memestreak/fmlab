import { silentWav } from '../../audio/iosUnlock';
import {
  holdPeak,
  meterPosition,
  METER_FLOOR_DB,
  PEAK_FALL_PER_SECOND,
  PEAK_HOLD_MS,
  peakOf,
  toDb,
} from '../../audio/level';

describe('peakOf', () => {
  it('is the largest absolute sample', () => {
    expect(peakOf(new Float32Array([0.1, -0.5, 0.25]))).toBe(0.5);
  });

  it('is 0 for silence and for nothing', () => {
    expect(peakOf(new Float32Array(8))).toBe(0);
    expect(peakOf([])).toBe(0);
  });
});

describe('toDb', () => {
  it('puts full scale at 0 dB and a tenth at -20 dB', () => {
    expect(toDb(1)).toBe(0);
    expect(toDb(0.1)).toBeCloseTo(-20, 10);
  });
});

describe('meterPosition', () => {
  it('is empty for silence and at the floor', () => {
    expect(meterPosition(0)).toBe(0);
    expect(meterPosition(10 ** (METER_FLOOR_DB / 20))).toBeCloseTo(0, 10);
    expect(meterPosition(1e-9)).toBe(0);
  });

  it('is full at full scale and stays full above it', () => {
    expect(meterPosition(1)).toBe(1);
    expect(meterPosition(2)).toBe(1);
  });

  it('is linear in dB between', () => {
    // -30 dB is halfway down a 60 dB meter.
    expect(meterPosition(10 ** (-30 / 20))).toBeCloseTo(0.5, 10);
    // The default volume, 0.2, is about -14 dB.
    expect(meterPosition(0.2)).toBeCloseTo(1 - 13.979 / 60, 3);
  });
});

describe('holdPeak', () => {
  const start = { position: 0.8, at: 1000 };

  it('rises with the level at once', () => {
    expect(holdPeak(start, 0.9, 1100, 16)).toEqual({ position: 0.9, at: 1100 });
  });

  it('holds for a second after the level drops', () => {
    expect(holdPeak(start, 0.3, 1500, 16)).toBe(start);
    expect(holdPeak(start, 0.3, 1000 + PEAK_HOLD_MS - 1, 16)).toBe(start);
  });

  it('then falls at a steady rate', () => {
    const after = holdPeak(start, 0.3, 2100, 100);
    expect(after.position).toBeCloseTo(0.8 - PEAK_FALL_PER_SECOND * 0.1, 10);
    // Still falling on the next frame: the hold is not started again.
    expect(holdPeak(after, 0.3, 2200, 100).position).toBeLessThan(after.position);
  });

  it('never falls below the level', () => {
    expect(holdPeak(start, 0.79, 5000, 1000).position).toBe(0.79);
  });

  it('holds again once the level has caught it', () => {
    const caught = holdPeak({ position: 0.5, at: 0 }, 0.5, 4000, 16);
    expect(holdPeak(caught, 0.2, 4500, 16)).toBe(caught);
  });
});

describe('silentWav', () => {
  const wav = silentWav();
  const text = (from: number, to: number) =>
    String.fromCharCode(...wav.subarray(from, to));

  it('has a WAV header that matches its length', () => {
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 12)).toBe('WAVE');
    expect(text(36, 40)).toBe('data');
    const view = new DataView(wav.buffer);
    expect(view.getUint32(4, true)).toBe(wav.length - 8);
    expect(view.getUint32(40, true)).toBe(wav.length - 44);
  });

  it('holds only silence, which is 128 in 8-bit audio', () => {
    expect(wav.subarray(44).every(byte => byte === 128)).toBe(true);
  });
});
