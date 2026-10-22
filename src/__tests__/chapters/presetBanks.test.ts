import { chapterById } from '../../chapters';
import { FMLAB_VOICES } from '../../chapters/fmlabVoices';
import { DX7_COUNT } from '../../dsp/algorithms';
import {
  DETUNE_CENTS,
  DX7_FEEDBACK,
  DX7_RATIO,
  LEVEL_DB,
  LFO_DELAY,
  LFO_SPEED,
  LFO_TREMOLO,
  LFO_VIBRATO,
  LFO_WAVES,
  MAX_STAGE_SECONDS,
  PITCH_EG_SPEED,
  PITCH_ENVELOPE_CENTS,
  RATE_SCALING,
  SCALING_DEPTH,
  SILENCE_DB,
} from '../../dsp/dx7';
import { DEFAULTS, type LabState, type Range } from '../../model/lab';
import { presetOf } from '../../ui/chapterView';
import { bankVoices, gridMove, openingBank, stepPreset } from '../../ui/presetGrid';

const sandbox = chapterById('sandbox')!;
const presets = sandbox.presets;
// Inside a range, give or take the converter's rounding (a pitch speed at
// its top, 14366.197, is written 14366.2, as the factory voices' are).
const within = (value: number, { min, max }: Range) => value >= min - 0.05 && value <= max + 0.05;

describe('the sandbox\'s two banks', () => {
  it('holds bank A, the factory voices, then bank B, fmlab\'s own', () => {
    expect(presets).toHaveLength(64);
    expect(sandbox.presetBanks?.map(bank => [bank.id, bank.name, presets[bank.start].label])).toEqual([
      ['A', 'DX7 factory voices © Yamaha', 'A11 E.PIANO 1'],
      ['B', 'fmlab voices', 'B1 TINE PIANO'],
    ]);
    expect(presets.slice(0, 32).every(preset => preset.bank === 'A')).toBe(true);
    expect(presets.slice(32).every(preset => preset.bank === 'B')).toBe(true);
    expect(presets[0].label).toBe('A1 BRASS 1');
    expect(presets[31].label).toBe('A32 TAKE OFF');
    expect(presets.slice(32).map(preset => preset.label.replace(/^B\d+ /, ''))).toEqual([
      'TINE PIANO', 'SUITCASE', 'REED PIANO', 'CLAVINET', 'HARPSICORD', 'DRAWBARS', 'PERC ORGAN', 'SOLID BASS',
      'SAW BASS', 'SLAP BASS', 'RUBBER BAS', 'SOFT BRASS', 'BRASS STAB', 'FLUTE', 'CLARINET', 'STRINGS',
      'WARM PAD', 'GLASS PAD', 'VOX PAD', 'SWEEP PAD', 'TUBE BELLS', 'CELESTA', 'MARIMBA', 'VIBES',
      'GAMELAN', 'HARP', 'KOTO', 'SAW LEAD', 'LOG DRUM', 'SNARE', 'LASER', 'WIND',
    ]);
    expect(presets[63].label).toBe('B32 WIND');
  });

  it('says bank B\'s voices are fmlab\'s own: no approximation, no note', () => {
    for (const preset of presets.slice(32)) {
      expect(preset.hint).toMatch(/^fmlab's own /);
      expect(preset.hint).not.toMatch(/approximat|Yamaha/);
      expect(preset.note).toBeUndefined();
    }
  });

  it('knows a voice from either bank by its sound', () => {
    for (let i = 0; i < presets.length; i++) {
      const state: LabState = { ...DEFAULTS, ...sandbox.patch, ...presets[i].patch };
      expect(presetOf(presets, state)).toBe(i);
    }
    // Edited: none.
    const edited = { ...DEFAULTS, ...sandbox.patch, ...presets[40].patch, dxFeedback: 1.234 };
    expect(presetOf(presets, edited)).toBe(-1);
  });

  it('steps through all 64 across the banks, round both ends', () => {
    const step = (at: number, by: number) => stepPreset(at, by, presets.length);
    // A11 on to A12; A32 on to B1; B32 round to A1; A1 back to B32.
    expect(step(10, 1)).toBe(11);
    expect(step(31, 1)).toBe(32);
    expect(step(32, -1)).toBe(31);
    expect(step(63, 1)).toBe(0);
    expect(step(0, -1)).toBe(63);
  });

  it('moves a column of eight on the window\'s glass, across the banks', () => {
    const shownA = { first: 0, last: 31 };
    const move = (key: string, at: number, rows = 8) => gridMove(key, at, presets.length, rows, shownA);
    // Up and down one voice, A32 down to B1.
    expect(move('ArrowDown', 10)).toBe(11);
    expect(move('ArrowUp', 10)).toBe(9);
    expect(move('ArrowDown', 31)).toBe(32);
    // Left and right a column, keeping the row: A25-A32 right to B1-B8,
    // B25-B32 round to A1-A8, A1 left to B25.
    expect(move('ArrowRight', 2)).toBe(10);
    expect(move('ArrowRight', 24)).toBe(32);
    expect(move('ArrowRight', 31)).toBe(39);
    expect(move('ArrowRight', 63)).toBe(7);
    expect(move('ArrowLeft', 0)).toBe(56);
    expect(move('ArrowLeft', 33)).toBe(25);
    // On a phone, two columns of 16.
    expect(move('ArrowRight', 20, 16)).toBe(36);
    // Home and End: the shown bank's first and last.
    expect(move('Home', 20)).toBe(0);
    expect(move('End', 20)).toBe(31);
    expect(move('Enter', 20)).toBeNull();
  });

  it('opens the window on the playing voice\'s bank, or once edited the last chosen\'s', () => {
    expect(openingBank(presets, 10, 40)).toBe('A');
    expect(openingBank(presets, 40, 10)).toBe('B');
    expect(openingBank(presets, -1, 40)).toBe('B');
    expect(openingBank(presets, -1, 10)).toBe('A');
    expect(bankVoices(presets, 'B')).toEqual(Array.from({ length: 32 }, (_, i) => 32 + i));
  });
});

describe('fmlab\'s own voices', () => {
  it('are 32, each played whole, six operators, every value inside the sandbox\'s ranges', () => {
    expect(FMLAB_VOICES).toHaveLength(32);
    for (const voice of FMLAB_VOICES) {
      expect(voice.missing).toEqual([]);
      expect(voice.dxOperators).toHaveLength(6);
      expect(Number.isInteger(voice.algorithm) && voice.algorithm >= 1 && voice.algorithm <= DX7_COUNT).toBe(true);
      expect(within(voice.dxFeedback, DX7_FEEDBACK)).toBe(true);
      for (const op of voice.dxOperators) {
        expect(within(op.ratio, DX7_RATIO)).toBe(true);
        expect(within(op.detune, DETUNE_CENTS)).toBe(true);
        expect(op.level === null || within(op.level, LEVEL_DB)).toBe(true);
        const { attack, peak, decay1, brk, decay2, sustain, release } = op.envelope;
        for (const seconds of [attack, decay1, decay2, release]) expect(within(seconds, { min: 0, max: MAX_STAGE_SECONDS })).toBe(true);
        for (const db of [peak, brk, sustain]) expect(within(db, { min: SILENCE_DB, max: 0 })).toBe(true);
        expect(within(op.left.depth, SCALING_DEPTH) && within(op.right.depth, SCALING_DEPTH)).toBe(true);
        expect(within(op.rateScaling, RATE_SCALING)).toBe(true);
        expect(within(op.tremolo, { min: 0, max: 1 })).toBe(true);
      }
      const lfo = voice.dxLfo;
      expect(LFO_WAVES).toContain(lfo.wave);
      expect(within(lfo.speed, LFO_SPEED) && within(lfo.delay, LFO_DELAY)).toBe(true);
      expect(within(lfo.vibrato, LFO_VIBRATO) && within(lfo.tremolo, LFO_TREMOLO)).toBe(true);
      const pitch = voice.dxPitchEnvelope;
      for (const cents of [pitch.start, pitch.peak, pitch.brk, pitch.sustain]) expect(within(cents, PITCH_ENVELOPE_CENTS)).toBe(true);
      for (const speed of [pitch.attack, pitch.decay1, pitch.decay2, pitch.release]) expect(within(speed, PITCH_EG_SPEED)).toBe(true);
    }
  });
});
