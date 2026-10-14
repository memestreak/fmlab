import { chapterByNumber } from '../../chapters';
import { DEFAULTS, type LabState } from '../../model/lab';
import { describeLive, isSounding, liveNote } from '../../ui/figures';
import {
  amplitudeFromDb,
  binHz,
  liveTrace,
  type Measurement,
} from '../../viz/liveSpectrum';

describe('binHz', () => {
  it('spaces the bins the sample rate over the FFT size apart', () => {
    expect(binHz(0, 8192, 48000)).toBe(0);
    expect(binHz(1, 8192, 48000)).toBeCloseTo(5.859, 3);
    expect(binHz(4096, 8192, 48000)).toBe(24000);
  });

  it('puts 220 Hz near bin 37.5 at 48 kHz', () => {
    expect(binHz(37.5466, 8192, 48000)).toBeCloseTo(220, 2);
  });
});

describe('amplitudeFromDb', () => {
  // The analyser's Blackman window keeps 0.42 of a sine's height, and its
  // transform halves it: a sine of amplitude 1 peaks at 0.21, -13.6 dB.
  const fullSine = 20 * Math.log10(0.21);

  it('reads a full-height sine as 1, the height of a predicted stem', () => {
    expect(amplitudeFromDb(fullSine)).toBeCloseTo(1, 9);
  });

  it('is linear in amplitude: 6 dB down is half as high', () => {
    expect(amplitudeFromDb(fullSine - 20 * Math.log10(2))).toBeCloseTo(0.5, 9);
    expect(amplitudeFromDb(fullSine - 20)).toBeCloseTo(0.1, 9);
  });

  it('reads silence, -Infinity, as nothing', () => {
    expect(amplitudeFromDb(-Infinity)).toBe(0);
    expect(amplitudeFromDb(NaN)).toBe(0);
  });
});

describe('liveTrace', () => {
  // Bins every 10 Hz up to 1 kHz, all silent but one at 220 Hz.
  const db = new Float32Array(101).fill(-Infinity);
  db[22] = 20 * Math.log10(0.21 * 0.5);
  const measured: Measurement = { db, sampleRate: 2000, fftSize: 200 };

  it('puts each bin at its frequency in carrier units', () => {
    const points = liveTrace(measured, 220, 4);
    expect(points[0]).toEqual({ freq: 0, amp: 0 });
    expect(points[22].freq).toBeCloseTo(1, 12);
    expect(points[22].amp).toBeCloseTo(0.5, 6);
  });

  it('stops at the end of the axis', () => {
    const points = liveTrace(measured, 220, 2);
    expect(points[points.length - 1].freq).toBeLessThanOrEqual(2);
    // 440 Hz is bin 44; nothing past it.
    expect(points).toHaveLength(45);
  });

  it('lines up with the predicted axis whatever the carrier', () => {
    expect(liveTrace(measured, 110, 4)[22].freq).toBeCloseTo(2, 12);
  });
});

describe('the live view\'s words', () => {
  const steady: LabState = { ...DEFAULTS, chapter: 7, liveSpectrum: true };
  const brass: LabState = {
    ...DEFAULTS,
    ...chapterByNumber(6)!.patch,
    noteStartedAt: 100,
    // As the engine fixes it when the note starts: brass is 0.75 s.
    noteLength: 0.75,
  };

  it('counts a steady sound, or a note not yet over, as sounding', () => {
    expect(isSounding(steady, 0)).toBe(false);
    expect(isSounding({ ...steady, playing: true }, 0)).toBe(true);
    expect(isSounding(brass, 100.5)).toBe(true);
    expect(isSounding(brass, 102)).toBe(false);
  });

  it('asks for Play when there is nothing to measure', () => {
    expect(liveNote(steady, false)).toBe('Press Play to hear it.');
    expect(describeLive(false)).toContain('lies flat');
  });

  it('says what it shows while there is', () => {
    expect(liveNote(steady, true)).toBe('Live: measured, over the predicted stems.');
    expect(describeLive(true)).toContain('measured from the sound now playing');
  });

  it('adds nothing to the caption in the predicted view', () => {
    expect(liveNote({ ...steady, liveSpectrum: false }, true)).toBe('');
  });
});
