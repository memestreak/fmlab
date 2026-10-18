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
    expect(soundFromParams(paramsFromHash(upgraded))).toMatchObject({ algorithm: 5, feedback: 0.7 });
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
  const six: LabState = {
    ...DEFAULTS,
    ...sandbox.patch,
    chapter: 'sandbox',
    carrierHz: 146.83,
    algorithm: 5,
    feedback: 0.7,
    operators: [
      { ratio: 1, level: 0.9, decay: 2.5 },
      { ratio: 1, level: 0.35, decay: 1.2 },
      { ratio: 1, level: 0.7, decay: 1.5 },
      { ratio: 14, level: 0.25, decay: 0.4 },
      { ratio: 1.414, level: 0.4, decay: 2 },
      { ratio: 1, level: 0.15, decay: 0 },
    ],
  };
  const reopened = (params: string) => ({
    ...DEFAULTS,
    ...sandbox.patch,
    ...soundFromParams(paramsFromHash(`#/sandbox?${params}`)),
  });

  it('is short and readable', () => {
    expect(soundParams(six)).toBe(
      'c=146.83&a=5&f=0.7&o=1_90_2.5-1_35_1.2-1_70_1.5-14_25_0.4-1.414_40_2-1_15_0',
    );
  });

  it('leaves the volume out: that is the listener\'s', () => {
    expect(soundParams({ ...six, volume: 0.5 })).not.toContain('0.5');
  });

  it('brings back the same sound, playing notes', () => {
    const back = reopened(soundParams(six));
    expect(back.mode).toBe('ops');
    expect(back.noteMode).toBe(true);
    expect(back.algorithm).toBe(5);
    expect(back.feedback).toBe(0.7);
    expect(back.operators).toEqual(six.operators);
    expect(back.carrierHz).toBeCloseTo(146.83, 1);
  });

  it('holds every value inside its range', () => {
    const back = reopened('a=40&f=9&o=0.1_150_9-1_0_0-1_0_0-1_0_0-1_0_0-99_0_0');
    expect(back.algorithm).toBe(32);
    expect(back.feedback).toBe(2);
    expect(back.operators[0]).toEqual({ ratio: 0.5, level: 1, decay: 6 });
    expect(back.operators[5]).toEqual({ ratio: 16, level: 0, decay: 0 });
    // A minus sign would split an operator in two: the link is damaged.
    expect(operatorsFromParam('1_1_1-1_1_1-1_1_1-1_1_1-1_1_1-1_-5_1')).toBeNull();
    expect(reopened('a=0').algorithm).toBe(1);
    expect(reopened('a=2.6').algorithm).toBe(3);
  });

  it('keeps the starting operators when the link\'s are damaged', () => {
    const start = sandbox.patch.operators;
    for (const o of ['1_1_1', '1_1_1-1_1_1-1_1_1-1_1_1-1_1_1', 'x_1_1-1_1_1-1_1_1-1_1_1-1_1_1-1_1_1', '1_1-1_1_1-1_1_1-1_1_1-1_1_1-1_1_1', '']) {
      expect(operatorsFromParam(o)).toBeNull();
      expect(reopened(`o=${o}`).operators).toEqual(start);
    }
    expect(reopened('a=abc&f=').algorithm).toBe(sandbox.patch.algorithm);
  });

  it('opens an old link, from when it had two operators, in six', () => {
    // "m=6" (six) or none (two): either way six now, keeping the pitch.
    const two = reopened('c=220&r=1.41&i=5');
    expect(two.mode).toBe('ops');
    expect(two.noteMode).toBe(true);
    expect(two.carrierHz).toBeCloseTo(220, 6);
    expect(two.algorithm).toBe(sandbox.patch.algorithm);
    expect(two.operators).toEqual(sandbox.patch.operators);
    expect(reopened('m=6&a=5').algorithm).toBe(5);
  });
});
