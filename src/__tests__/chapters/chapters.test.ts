import {
  chapterByNumber,
  CHAPTERS,
  FIRST_CHAPTER,
  neighbours,
} from '../../chapters';
import { chapterFromHash, hashForChapter } from '../../chapters/route';
import {
  CARRIER_HZ,
  clamp,
  DEVIATION_HZ,
  INDEX,
  MOD_HZ,
  RATIO,
} from '../../model/lab';

const NUMBERS = CHAPTERS.map(chapter => chapter.number);
const SLIDERS = ['volume', 'carrier', 'ratio', 'index', 'modHz', 'deviation'];

describe('the chapters', () => {
  it('are in order, each with its own number', () => {
    expect(NUMBERS).toEqual([...new Set(NUMBERS)].sort((a, b) => a - b));
    expect(FIRST_CHAPTER).toBe(1);
  });

  it('are the first two lessons and the sandbox, numbered as in the spec', () => {
    expect(CHAPTERS.map(c => [c.number, c.title])).toEqual([
      [1, 'A single sine'],
      [2, 'Vibrato becomes timbre'],
      [7, 'Sandbox'],
    ]);
  });

  it.each(CHAPTERS)('$title has text, captions and a contents label', chapter => {
    expect(chapter.body.length).toBeGreaterThan(0);
    expect(chapter.body.every(text => text.trim().length > 0)).toBe(true);
    expect(chapter.navLabel).not.toBe('');
    expect(chapter.captions.waveform).not.toBe('');
    expect(chapter.captions.spectrum).not.toBe('');
    for (const panel of chapter.maths) {
      expect(panel.title).not.toBe('');
      expect(panel.body.length).toBeGreaterThan(0);
    }
  });

  it.each(CHAPTERS)('$title shows sliders that exist, volume among them', chapter => {
    expect(chapter.controls.every(id => SLIDERS.includes(id))).toBe(true);
    expect(new Set(chapter.controls).size).toBe(chapter.controls.length);
    expect(chapter.controls).toContain('volume');
  });

  it.each(CHAPTERS)('$title starts inside every slider range', ({ patch }) => {
    expect(clamp(patch.carrierHz, CARRIER_HZ)).toBe(patch.carrierHz);
    expect(clamp(patch.ratio, RATIO)).toBe(patch.ratio);
    expect(clamp(patch.index, INDEX)).toBe(patch.index);
    expect(clamp(patch.modHz, MOD_HZ)).toBe(patch.modHz);
    expect(clamp(patch.deviationHz, DEVIATION_HZ)).toBe(patch.deviationHz);
  });

  it.each(CHAPTERS)('$title only shows sliders its mode listens to', chapter => {
    const deaf =
      chapter.patch.mode === 'pm' ? ['modHz', 'deviation'] : ['ratio', 'index'];
    expect(chapter.controls.filter(id => deaf.includes(id))).toEqual([]);
  });

  it('opens on a single sine: no modulation, no modulator drawn', () => {
    const { patch, controls } = CHAPTERS[0];
    expect(patch.mode).toBe('pm');
    expect(patch.index).toBe(0);
    expect(patch.showModulator).toBe(false);
    expect(controls).toEqual(['volume', 'carrier']);
  });

  it('plays chapter 2 as true FM, starting as a vibrato', () => {
    const { patch, controls } = chapterByNumber(2)!;
    expect(patch.mode).toBe('fm');
    expect(patch.modHz).toBeLessThan(10);
    expect(patch.deviationHz).toBeGreaterThan(0);
    expect(controls).toEqual(['volume', 'modHz', 'deviation']);
  });

  it('is the only chapter in true FM', () => {
    expect(CHAPTERS.filter(c => c.patch.mode === 'fm').map(c => c.number)).toEqual([2]);
  });
});

describe('neighbours', () => {
  it('has nothing before the first or after the last', () => {
    expect(neighbours(1).previous).toBeUndefined();
    expect(neighbours(7).next).toBeUndefined();
  });

  it('steps over the chapters not written yet', () => {
    expect(neighbours(2).previous?.number).toBe(1);
    expect(neighbours(2).next?.number).toBe(7);
    expect(neighbours(7).previous?.number).toBe(2);
  });

  it('has none for a chapter that does not exist', () => {
    expect(neighbours(4)).toEqual({});
  });
});

describe('chapterFromHash', () => {
  it('reads the chapter number', () => {
    expect(chapterFromHash('#1', NUMBERS, 1)).toBe(1);
    expect(chapterFromHash('#2', NUMBERS, 1)).toBe(2);
    expect(chapterFromHash('#7', NUMBERS, 1)).toBe(7);
  });

  it('falls back when there is no hash', () => {
    expect(chapterFromHash('', NUMBERS, 1)).toBe(1);
    expect(chapterFromHash('#', NUMBERS, 1)).toBe(1);
  });

  it('falls back for a chapter that is not written yet', () => {
    expect(chapterFromHash('#4', NUMBERS, 1)).toBe(1);
    expect(chapterFromHash('#99', NUMBERS, 1)).toBe(1);
  });

  it('falls back for anything that is not a plain number', () => {
    for (const hash of ['#two', '#2a', '#-2', '#2.5', '# 2', '#/2']) {
      expect(chapterFromHash(hash, NUMBERS, 1)).toBe(1);
    }
  });

  it('reads back what hashForChapter writes', () => {
    for (const number of NUMBERS) {
      expect(chapterFromHash(hashForChapter(number), NUMBERS, 1)).toBe(number);
    }
  });
});
