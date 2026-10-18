import { chapterById, CHAPTERS } from '../../chapters';
import {
  viewFromHash,
  hashFor,
  isStrayHash,
  operatorsFromParam,
  paramsFromHash,
  soundFromParams,
  soundParams,
  upgradeHash,
} from '../../chapters/route';
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
  const piano = chapterById('sandbox')!.presets.find(p => p.label === 'E. piano')!.patch;
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

  it('is readable, each operator in fourteen short fields', () => {
    const params = new URLSearchParams(soundParams(six));
    expect(params.get('c')).toBe('146.83');
    expect(params.get('a')).toBe('5');
    expect(params.get('f')).toBe('3.142');
    const ops = params.get('o')!.split('~');
    expect(ops).toHaveLength(6);
    // OP4: ratio 14, no detune, -12 dB; attack 2 ms to 0 dB, 150 ms to the
    // break at -18 dB, 800 ms to sustain at -60 dB, release 200 ms; break
    // point C4, quieter up the keyboard, 1.42 times faster an octave up.
    expect(ops[3]).toBe('14_0_-12_0.002_0_0.15_-18_0.8_-60_0.2_60_l0_l-3_1.42');
  });

  it('leaves the volume out: that is the listener\'s', () => {
    expect(soundParams({ ...six, volume: 0.5 })).not.toContain('0.5');
  });

  it('brings back the same sound, playing notes', () => {
    const back = reopened(soundParams(six));
    expect(back.mode).toBe('ops');
    expect(back.voiceModel).toBe('dx7');
    expect(back.noteMode).toBe(true);
    expect(back.algorithm).toBe(5);
    expect(back.dxFeedback).toBeCloseTo(Math.PI, 3);
    expect(back.dxOperators).toEqual(six.dxOperators);
    expect(back.carrierHz).toBeCloseTo(146.83, 1);
  });

  it('carries an operator that is off', () => {
    const off = { ...six, dxOperators: six.dxOperators.map((o, i) => (i === 5 ? { ...o, level: null } : o)) };
    expect(reopened(soundParams(off)).dxOperators[5].level).toBeNull();
  });

  it('holds every value inside its range', () => {
    const wild = '99_9_5_99_9_-1_-200_0_0_-5_0_e99_l-99_9';
    const back = reopened(`a=40&f=9&o=${[wild, ...Array(5).fill(wild)].join('~')}`);
    expect(back.algorithm).toBe(32);
    expect(back.dxFeedback).toBeCloseTo(2 * Math.PI, 9);
    const op = back.dxOperators[0];
    expect(op.ratio).toBe(61.69);
    expect(op.detune).toBe(6.3);
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
