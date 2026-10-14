import { chapterByNumber, CHAPTERS } from '../../chapters';
import {
  chapterFromHash,
  hashForChapter,
  isStrayHash,
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
    expect(isStrayHash('#9?c=220', NUMBERS)).toBe(true);
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
