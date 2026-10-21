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
import { presetOf, stepInBank } from '../../ui/chapterView';

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

  it('steps round the shown bank only', () => {
    // A11 on to A12, A32 round to A1, A1 back to A32.
    expect(stepInBank(presets, 10, 1)).toBe(11);
    expect(stepInBank(presets, 31, 1)).toBe(0);
    expect(stepInBank(presets, 0, -1)).toBe(31);
    // B1 back to B32, B32 on to B1.
    expect(stepInBank(presets, 32, -1)).toBe(63);
    expect(stepInBank(presets, 63, 1)).toBe(32);
    expect(stepInBank(presets, 40, 1)).toBe(41);
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
