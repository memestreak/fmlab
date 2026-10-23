import { chapterById, CHAPTERS } from '../../chapters';
import {
  viewFromHash,
  hashFor,
  isStrayHash,
  operatorsFromParam,
  paramsFromHash,
  shareFromPercent,
  soundFromParams,
  soundParams,
  upgradeHash,
} from '../../chapters/route';
import { LFO_DELAY, LFO_SPEED, LFO_TREMOLO, LFO_VIBRATO, PITCH_EG_SPEED } from '../../dsp/dx7';
import { DEFAULTS, hzToSemitones, type LabState } from '../../model/lab';

const IDS = CHAPTERS.map(chapter => chapter.id);
describe('a hash with a sound in it', () => {
  it('still names its section', () => {
    expect(viewFromHash('#/sandbox?c=220&r=1&i=2', IDS, 'landing')).toBe('sandbox');
    expect(isStrayHash('#/sandbox?c=220&r=1&i=2', IDS)).toBe(false);
    expect(isStrayHash('#/nowhere?c=220', IDS)).toBe(true);
  });

  it('gives up its parameters', () => {
    expect(paramsFromHash('#/sandbox?c=220&r=1.41&i=5').get('r')).toBe('1.41');
    expect([...paramsFromHash('#/sandbox')]).toEqual([]);
    expect([...paramsFromHash('')]).toEqual([]);
  });

  it('is written with the parameters after a "?"', () => {
    expect(hashFor('sandbox', 'c=220')).toBe('#/sandbox?c=220');
    expect(hashFor('sandbox')).toBe('#/sandbox');
    expect(hashFor('sandbox', '')).toBe('#/sandbox');
  });

  it('from before the sections had names still opens in the sandbox', () => {
    const upgraded = upgradeHash('#7?m=6&a=5&f=0.7')!;
    expect(viewFromHash(upgraded, IDS, 'landing')).toBe('sandbox');
    expect(soundFromParams(paramsFromHash(upgraded))).toMatchObject({ algorithm: 5, dxFeedback: 0.7 });
  });
});

describe('soundFromParams', () => {
  const read = (query: string) => soundFromParams(new URLSearchParams(query));

  it('puts a typed carrier on the nearest step of the Carrier slider', () => {
    const { carrierHz } = read('c=221');
    const steps = hzToSemitones(carrierHz!) * 4;
    expect(steps).toBeCloseTo(Math.round(steps), 9);
    // A quarter semitone up from 220 Hz is 223.2 Hz: 221 is nearer 220.
    expect(carrierHz).toBeCloseTo(220, 6);
    expect(read('c=222').carrierHz).toBeCloseTo(220 * 2 ** (1 / 48), 6);
    expect(read('c=20000').carrierHz).toBeCloseTo(880, 9);
    expect(read('c=1').carrierHz).toBeCloseTo(55, 9);
  });

  it('leaves out what is missing, empty or not a number', () => {
    expect(read('')).toEqual({});
    expect(read('c=&a=abc&f=NaN')).toEqual({});
    expect(read('c=-5')).toEqual({});
    expect(read('f=Infinity')).toEqual({});
  });
});

describe('which chapters keep their sound in the URL', () => {
  it('is the sandbox alone', () => {
    expect(CHAPTERS.filter(c => c.sharesSound).map(c => c.id)).toEqual(['sandbox']);
    expect(chapterById('sandbox')!.sharesSound).toBe(true);
  });
});

describe('the sandbox in a link', () => {
  const sandbox = chapterById('sandbox')!;
  const piano = chapterById('sandbox')!.presets.find(p => p.label === 'A11 E.PIANO 1')!.patch;
  const six: LabState = {
    ...DEFAULTS,
    ...sandbox.patch,
    ...piano,
    chapter: 'sandbox',
    carrierHz: 146.83,
  };
  const reopened = (params: string) => ({
    ...DEFAULTS,
    ...sandbox.patch,
    ...soundFromParams(paramsFromHash(`#/sandbox?${params}`)),
  });

  it('is readable, each operator in fifteen short fields, the LFO in eight', () => {
    const params = new URLSearchParams(soundParams(six));
    expect(params.has('c')).toBe(false);
    expect(params.get('a')).toBe('5');
    expect(params.get('f')).toBe('3.1415');
    const ops = params.get('o')!.split('~');
    expect(ops).toHaveLength(6);
    // E.PIANO 1's OP2: ratio 14, no detune, -30.75 dB; attack 1 ms to
    // 0 dB, 279 ms to the break at -18.06 dB, 3.37 s to silence; break
    // point A-1, no level scaling, 1.3 times faster an octave up; none of
    // the tremolo.
    expect(ops[1]).toBe('14_0_-30.75_0.001_0_0.2786_-18.06_3.3747_-96_0.0741_21_l0_l0_1.2968_0');
    // Its LFO: a sine at 5.61 Hz, 0.15 s late, no vibrato or tremolo.
    // The wheel's vibrato and tremolo last: every voice opens on 50 ¢ and 0 dB.
    expect(params.get('l')).toBe('sine_5.613_0.148_0_0_0_50_0');
    // Its pitch envelope, flat, with the factory's speeds: levels in cents,
    // speeds in cents a second.
    expect(params.get('p')).toBe('0_11380.28_0_4056.34_0_11887.32_0_3267.61');
  });

  it('leaves the volume out: that is the listener\'s', () => {
    expect(soundParams({ ...six, volume: 0.5 })).not.toContain('0.5');
  });

  // Jeremy, 2026-10-23: "Why does the URL change every time I play a note?"
  it('leaves the pitch out: a note played does not change the link', () => {
    expect(soundParams({ ...six, carrierHz: 440 })).toBe(soundParams(six));
    expect(soundParams({ ...six, carrierHz: 65.41 })).toBe(soundParams(six));
  });

  it('brings back the same sound, playing notes', () => {
    const back = reopened(soundParams(six));
    expect(back.mode).toBe('ops');
    expect(back.voiceModel).toBe('dx7');
    expect(back.noteMode).toBe(true);
    expect(back.algorithm).toBe(5);
    expect(back.dxFeedback).toBeCloseTo(Math.PI, 3);
    expect(back.dxOperators).toEqual(six.dxOperators);
    expect(back.dxPitchEnvelope).toEqual(six.dxPitchEnvelope);
    // The pitch is the sandbox's own: the link does not carry it.
    expect(back.carrierHz).toBe(sandbox.patch.carrierHz ?? DEFAULTS.carrierHz);
  });

  it('carries an operator that is off', () => {
    const off = { ...six, dxOperators: six.dxOperators.map((o, i) => (i === 5 ? { ...o, level: null } : o)) };
    expect(reopened(soundParams(off)).dxOperators[5].level).toBeNull();
  });

  it('holds every value inside its range', () => {
    const wild = '99_9_5_99_9_-1_-200_0_0_-5_0_e99_l-99_9_40';
    const back = reopened(`a=40&f=9&o=${[wild, ...Array(5).fill(wild)].join('~')}&l=square_99_9_5000_500_1_9999_-4`);
    expect(back.algorithm).toBe(32);
    expect(back.dxFeedback).toBeCloseTo(2 * Math.PI, 9);
    const op = back.dxOperators[0];
    expect(op.ratio).toBe(61.69);
    expect(op.detune).toBeCloseTo(6.3116, 4);
    expect(op.level).toBe(0);
    expect(op.envelope.attack).toBe(40);
    expect(op.envelope.peak).toBe(0);
    expect(op.envelope.decay1).toBe(0);
    expect(op.envelope.brk).toBe(-96);
    expect(op.envelope.release).toBe(0);
    expect(op.breakKey).toBe(21);
    expect(op.left.depth).toBeCloseTo(5.96, 2);
    expect(op.right.depth).toBeCloseTo(-5.96, 2);
    expect(op.rateScaling).toBeCloseTo(2 ** (7 / 8), 9);
    // A share is any percentage, not only the DX7's four: 40 % is 40 %.
    expect(op.tremolo).toBe(0.4);
    // Held inside 0 to 100 %, to 0.1 %; a factory share written to 0.1 %
    // comes back exact.
    expect(shareFromPercent(150)).toBe(1);
    expect(shareFromPercent(-5)).toBe(0);
    expect(shareFromPercent(33.333)).toBe(0.333);
    expect(shareFromPercent(25.9)).toBe(4342338 / 2 ** 24);
    expect(back.dxLfo).toEqual({
      wave: 'square',
      speed: LFO_SPEED.max,
      delay: LFO_DELAY.max,
      vibrato: LFO_VIBRATO.max,
      tremolo: LFO_TREMOLO.max,
      sync: true,
      wheelVibrato: LFO_VIBRATO.max,
      wheelTremolo: 0,
    });
    // A link from before the wheel, its LFO in six fields, gets the wheel's defaults.
    expect(reopened('l=sine_1_0_10_2_0').dxLfo).toEqual({
      wave: 'sine',
      speed: 1,
      delay: 0,
      vibrato: 10,
      tremolo: 2,
      sync: false,
      wheelVibrato: 50,
      wheelTremolo: 0,
    });
    // Seven fields is not an LFO, nor a wheel depth that is not a number.
    expect(reopened('l=sine_1_0_10_2_0_5').dxLfo).toEqual(sandbox.patch.dxLfo);
    expect(reopened('l=sine_1_0_10_2_0_x_0').dxLfo).toEqual(sandbox.patch.dxLfo);
    // The pitch envelope's levels to four octaves, its speeds to msfa's.
    const bent = reopened('p=9000_1_-9000_99999_120_300_-50_600').dxPitchEnvelope;
    expect(bent).toEqual({
      start: 4800,
      attack: PITCH_EG_SPEED.min,
      peak: -4800,
      decay1: PITCH_EG_SPEED.max,
      brk: 120,
      decay2: 300,
      sustain: -50,
      release: 600,
    });
    expect(reopened('p=1_2_3').dxPitchEnvelope).toEqual(sandbox.patch.dxPitchEnvelope);
    // An LFO that is not one is passed over.
    expect(reopened('l=wobble_1_0_0_0_1').dxLfo).toEqual(sandbox.patch.dxLfo);
    expect(reopened('a=0').algorithm).toBe(1);
    expect(reopened('a=2.6').algorithm).toBe(3);
  });

  it('keeps the starting voice when the link\'s is damaged, or from before', () => {
    const start = sandbox.patch.dxOperators;
    const good = soundParams(six).split('o=')[1];
    for (const o of [
      '1_1_1-1_1_1-1_1_1-1_1_1-1_1_1-1_1_1',
      good.split('~').slice(0, 5).join('~'),
      good.replace('_l0_', '_q0_'),
      good.replace('14_0_-12', 'x_0_-12'),
      '',
    ]) {
      expect(operatorsFromParam(o)).toBeNull();
      expect(reopened(`o=${encodeURIComponent(o)}`).dxOperators).toEqual(start);
    }
    expect(reopened('a=abc&f=').algorithm).toBe(sandbox.patch.algorithm);
  });

  it('opens an old link with its pitch and algorithm', () => {
    const two = reopened('c=220&r=1.41&i=5');
    expect(two.voiceModel).toBe('dx7');
    expect(two.carrierHz).toBeCloseTo(220, 6);
    expect(two.dxOperators).toEqual(sandbox.patch.dxOperators);
    expect(reopened('m=6&a=5').algorithm).toBe(5);
  });
});
