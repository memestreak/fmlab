import { chapterByNumber, CHAPTERS, labViewOf, operatorCountPatch } from '../../chapters';
import {
  chapterFromHash,
  hashForChapter,
  isStrayHash,
  operatorsFromParam,
  paramsFromHash,
  soundFromParams,
  soundParams,
} from '../../chapters/route';
import { DEFAULTS, hzToSemitones, type LabState } from '../../model/lab';

const NUMBERS = CHAPTERS.map(chapter => chapter.number);
const sound = (carrierHz: number, ratio: number, index: number): LabState => ({
  ...DEFAULTS,
  chapter: 7,
  carrierHz,
  ratio,
  index,
});

describe('a hash with a sound in it', () => {
  it('still names its chapter', () => {
    expect(chapterFromHash('#7?c=220&r=1&i=2', NUMBERS, 0)).toBe(7);
    expect(isStrayHash('#7?c=220&r=1&i=2', NUMBERS)).toBe(false);
    expect(isStrayHash('#10?c=220', NUMBERS)).toBe(true);
  });

  it('gives up its parameters', () => {
    expect(paramsFromHash('#7?c=220&r=1.41&i=5').get('r')).toBe('1.41');
    expect([...paramsFromHash('#7')]).toEqual([]);
    expect([...paramsFromHash('')]).toEqual([]);
  });

  it('is written with the parameters after a "?"', () => {
    expect(hashForChapter(7, 'c=220')).toBe('#7?c=220');
    expect(hashForChapter(7)).toBe('#7');
    expect(hashForChapter(7, '')).toBe('#7');
  });
});

describe('soundParams', () => {
  it('writes the carrier, ratio and index, briefly', () => {
    expect(soundParams(sound(220, 1, 2))).toBe('c=220&r=1&i=2');
    expect(soundParams(sound(261.6255653, 1.414, 5))).toBe('c=261.63&r=1.414&i=5');
  });

  it('leaves the volume out: that is the listener\'s', () => {
    expect(soundParams({ ...sound(220, 1, 2), volume: 0.5 })).not.toContain('0.5');
  });
});

describe('soundFromParams', () => {
  const read = (query: string) => soundFromParams(new URLSearchParams(query));

  it('reads back what soundParams writes', () => {
    for (const [c, r, i] of [[220, 1, 2], [110, 2.5, 0.8], [880, 1.414, 10]] as const) {
      const patch = read(soundParams(sound(c, r, i)));
      expect(patch.carrierHz).toBeCloseTo(c, 6);
      expect(patch.ratio).toBe(r);
      expect(patch.index).toBe(i);
    }
  });

  it('puts a typed carrier on the nearest step of the Carrier slider', () => {
    const { carrierHz } = read('c=221');
    const steps = hzToSemitones(carrierHz!) * 4;
    expect(steps).toBeCloseTo(Math.round(steps), 9);
    // A quarter semitone up from 220 Hz is 223.2 Hz: 221 is nearer 220.
    expect(carrierHz).toBeCloseTo(220, 6);
    expect(read('c=222').carrierHz).toBeCloseTo(220 * 2 ** (1 / 48), 6);
  });

  it('holds every value inside its slider\'s range', () => {
    expect(read('c=20000&r=99&i=-3')).toEqual({ carrierHz: 880, ratio: 8, index: 0 });
    expect(read('c=1').carrierHz).toBeCloseTo(55, 9);
  });

  it('leaves out what is missing, empty or not a number', () => {
    expect(read('')).toEqual({});
    expect(read('c=&r=abc&i=NaN')).toEqual({});
    expect(read('c=-5')).toEqual({});
    expect(read('r=2')).toEqual({ ratio: 2 });
    expect(read('i=Infinity')).toEqual({});
  });
});

describe('which chapters keep their sound in the URL', () => {
  it('is the sandbox alone', () => {
    expect(CHAPTERS.filter(c => c.sharesSound).map(c => c.number)).toEqual([7]);
    expect(chapterByNumber(7)!.sharesSound).toBe(true);
  });
});

describe('the six-operator sandbox in a link', () => {
  const sandbox = chapterByNumber(7)!;
  const six: LabState = {
    ...DEFAULTS,
    ...sandbox.patch,
    ...operatorCountPatch(DEFAULTS, true),
    chapter: 7,
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
    ...soundFromParams(paramsFromHash(`#7?${params}`)),
  });

  it('is short and readable', () => {
    expect(soundParams(six)).toBe(
      'm=6&c=146.83&a=5&f=0.7&o=1_90_2.5-1_35_1.2-1_70_1.5-14_25_0.4-1.414_40_2-1_15_0',
    );
  });

  it('brings back the same sound, playing notes', () => {
    const back = reopened(soundParams(six));
    expect(back.mode).toBe('ops');
    expect(back.noteMode).toBe(true);
    expect(back.algorithm).toBe(5);
    expect(back.feedback).toBe(0.7);
    expect(back.operators).toEqual(six.operators);
    expect(back.carrierHz).toBeCloseTo(146.83, 1);
    expect(labViewOf(sandbox, back)).toBe(sandbox.sixOperators);
  });

  it('holds every value inside its range', () => {
    const back = reopened('m=6&a=40&f=9&o=0.1_150_9-1_0_0-1_0_0-1_0_0-1_0_0-99_0_0');
    expect(back.algorithm).toBe(32);
    expect(back.feedback).toBe(2);
    expect(back.operators[0]).toEqual({ ratio: 0.5, level: 1, decay: 6 });
    expect(back.operators[5]).toEqual({ ratio: 16, level: 0, decay: 0 });
    // A minus sign would split an operator in two: the link is damaged.
    expect(operatorsFromParam('1_1_1-1_1_1-1_1_1-1_1_1-1_1_1-1_-5_1')).toBeNull();
    expect(reopened('m=6&a=0').algorithm).toBe(1);
    expect(reopened('m=6&a=2.6').algorithm).toBe(3);
  });

  it('keeps the starting operators when the link\'s are damaged', () => {
    const start = sandbox.patch.operators;
    for (const o of ['1_1_1', '1_1_1-1_1_1-1_1_1-1_1_1-1_1_1', 'x_1_1-1_1_1-1_1_1-1_1_1-1_1_1-1_1_1', '1_1-1_1_1-1_1_1-1_1_1-1_1_1-1_1_1', '']) {
      expect(operatorsFromParam(o)).toBeNull();
      expect(reopened(`m=6&o=${o}`).operators).toEqual(start);
    }
    expect(reopened('m=6&a=abc&f=').algorithm).toBe(sandbox.patch.algorithm);
  });

  it('leaves old two-operator links exactly as they were', () => {
    const back = reopened('c=220&r=1.41&i=5');
    expect(back.mode).toBe('pm');
    expect(back.noteMode).toBe(false);
    expect([back.ratio, back.index]).toEqual([1.41, 5]);
    expect(labViewOf(sandbox, back)).toBe(sandbox);
    // Only "m=6" means six; anything else is two, as before.
    expect(reopened('m=2&r=2').mode).toBe('pm');
    // And a two-operator sound is still written the old way.
    expect(soundParams({ ...back })).toBe('c=220&r=1.41&i=5');
  });
});

describe('the sandbox switch', () => {
  const sandbox = chapterByNumber(7)!;

  it('has a six-operator lab with chapter 8\'s pieces and the keyboard', () => {
    const six = sandbox.sixOperators!;
    expect(six.controls).toEqual(['volume', 'feedback']);
    expect(Object.keys(six.figures)).toEqual(['algorithm', 'spectrum']);
    expect(six.presets).toBe(chapterByNumber(8)!.presets);
    expect(six.hasPiano && six.sharesSound).toBe(true);
    expect(six.body).toBe(sandbox.body);
    // It starts from chapter 8's Stacks, a DX7 algorithm.
    expect(sandbox.patch.algorithm).toBe(1);
  });

  it('switches to notes and back to a steady sound, stopping what sounds', () => {
    expect(operatorCountPatch({ stops: 3 }, true)).toEqual({ mode: 'ops', noteMode: true, playing: false });
    expect(operatorCountPatch({ stops: 3 }, false)).toEqual({
      mode: 'pm',
      noteMode: false,
      stops: 4,
      noteStartedAt: null,
    });
  });

  it('is the only chapter with one', () => {
    expect(CHAPTERS.filter(c => c.sixOperators).map(c => c.number)).toEqual([7]);
  });
});
