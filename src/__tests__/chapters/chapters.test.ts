import {
  chapterByNumber,
  CHAPTERS,
  FIRST_CHAPTER,
  neighbours,
} from '../../chapters';
import { chapterFromHash, hashForChapter } from '../../chapters/route';
import { besselJ } from '../../dsp/bessel';
import { fmSpectrum } from '../../dsp/fmSpectrum';
import {
  CARRIER_HZ,
  clamp,
  DEVIATION_HZ,
  INDEX,
  MOD_HZ,
  RATIO,
} from '../../model/lab';

const NUMBERS = CHAPTERS.map(chapter => chapter.number);
const SLIDERS = [
  'volume',
  'carrier',
  'ratio',
  'index',
  'modHz',
  'deviation',
  'attack',
  'decay',
  'sustain',
  'release',
  'feedback',
];
const FIGURES = ['algorithm', 'compare', 'waveform', 'envelope', 'spectrum', 'spectrogram', 'bessel'];

describe('the chapters', () => {
  it('are in order, each with its own number', () => {
    expect(NUMBERS).toEqual([...new Set(NUMBERS)].sort((a, b) => a - b));
    expect(FIRST_CHAPTER).toBe(1);
  });

  it("are version 1's seven and chapters 8 and 9, numbered as in the spec", () => {
    expect(CHAPTERS.map(c => [c.number, c.title])).toEqual([
      [1, 'A single sine'],
      [2, 'Vibrato becomes timbre'],
      [3, 'Modulation index'],
      [4, 'Sidebands and Bessel functions'],
      [5, 'Carrier to modulator ratio'],
      [6, 'Time-varying index'],
      [7, 'Sandbox'],
      [8, 'Operators and algorithms'],
      [9, 'FM versus PM'],
    ]);
  });

  it.each(CHAPTERS)('$title shows two figures, and captions what it shows', chapter => {
    const shown = Object.entries(chapter.figures);
    expect(shown).toHaveLength(2);
    for (const [id, caption] of shown) {
      expect(FIGURES).toContain(id);
      expect(caption.trim()).not.toBe('');
    }
  });

  // A spectrum of some kind: the line spectrum, or for a note that
  // changes as it sounds, the spectrogram.
  it.each(CHAPTERS)('$title shows what the sound is made of', chapter => {
    expect(
      chapter.figures.spectrum ?? chapter.figures.spectrogram,
    ).toBeDefined();
  });

  it.each(CHAPTERS)('$title has presets that say what they are for', chapter => {
    for (const preset of chapter.presets) {
      expect(preset.label).not.toBe('');
      expect(preset.hint).not.toBe('');
      expect(Object.keys(preset.patch).length).toBeGreaterThan(0);
    }
  });

  it.each(CHAPTERS)('$title has text and a contents label', chapter => {
    expect(chapter.body.length).toBeGreaterThan(0);
    expect(chapter.body.every(text => text.trim().length > 0)).toBe(true);
    expect(chapter.navLabel).not.toBe('');
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

  // A slider can only show a value inside its range. A chapter may hold a
  // value outside one it does not show: chapter 4's ratio of 1/16 is
  // below the Ratio slider's bottom, and has no Ratio slider.
  it.each(CHAPTERS)('$title starts inside the range of every slider it shows', chapter => {
    const { patch, controls } = chapter;
    const ranged = [
      ['carrier', patch.carrierHz, CARRIER_HZ],
      ['ratio', patch.ratio, RATIO],
      ['index', patch.index, INDEX],
      ['modHz', patch.modHz, MOD_HZ],
      ['deviation', patch.deviationHz, DEVIATION_HZ],
    ] as const;
    for (const [id, value, range] of ranged) {
      if (controls.includes(id)) expect(clamp(value, range)).toBe(value);
    }
    // The index is also the Bessel plot's line, and the carrier is always
    // heard, slider or not.
    expect(clamp(patch.index, INDEX)).toBe(patch.index);
    expect(clamp(patch.carrierHz, CARRIER_HZ)).toBe(patch.carrierHz);
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

describe('chapter 3, modulation index', () => {
  const chapter = chapterByNumber(3)!;

  it('holds the ratio at 1 and offers only the index', () => {
    expect(chapter.patch.mode).toBe('pm');
    expect(chapter.patch.ratio).toBe(1);
    expect(chapter.controls).toEqual(['volume', 'index']);
  });

  it("brackets Carson's rule on its spectrum, and is the only one to", () => {
    expect(chapter.patch.showBandwidth).toBe(true);
    expect(CHAPTERS.filter(c => c.patch.showBandwidth).map(c => c.number)).toEqual([3]);
  });
});

describe('chapter 4, Bessel functions', () => {
  const chapter = chapterByNumber(4)!;

  it('is the only chapter with the Bessel plot, beside the spectrum', () => {
    expect(Object.keys(chapter.figures)).toEqual(['spectrum', 'bessel']);
    expect(CHAPTERS.filter(c => c.figures.bessel).map(c => c.number)).toEqual([4]);
  });

  it('leaves the index to the plot: no index slider', () => {
    expect(chapter.controls).toEqual(['volume']);
  });

  it('keeps every sideband that can be picked out clear of zero', () => {
    // So each stem is one sideband, J_n tall: no folding among the eight
    // orders the plot draws, or the few beyond them that still show.
    const { ratio, carrierHz } = chapter.patch;
    expect(1 - 12 * ratio).toBeGreaterThan(0);
    expect(carrierHz * ratio).toBeCloseTo(55, 9);
  });

  it('has a spectrum whose stems are the Bessel values themselves', () => {
    const { ratio } = chapter.patch;
    const lines = fmSpectrum(ratio, 2.405);
    const ampAt = (freq: number) =>
      lines.find(line => Math.abs(line.freq - freq) < 1e-9)?.amp ?? 0;
    // The carrier has vanished, and the first pair points opposite ways.
    expect(Math.abs(ampAt(1))).toBeLessThan(1e-3);
    expect(ampAt(1 + ratio)).toBeCloseTo(besselJ(1, 2.405), 9);
    expect(ampAt(1 - ratio)).toBeCloseTo(-besselJ(1, 2.405), 9);
    expect(ampAt(1 + 2 * ratio)).toBeCloseTo(ampAt(1 - 2 * ratio), 9);
  });
});

describe('neighbours', () => {
  it('has nothing before the first or after the last', () => {
    expect(neighbours(1).previous).toBeUndefined();
    expect(neighbours(9).next).toBeUndefined();
  });

  it('are the chapters either side', () => {
    expect(neighbours(2).previous?.number).toBe(1);
    expect(neighbours(2).next?.number).toBe(3);
    expect(neighbours(4).next?.number).toBe(5);
    expect(neighbours(7).previous?.number).toBe(6);
  });

  it('has none for a chapter that does not exist', () => {
    expect(neighbours(10)).toEqual({});
    expect(neighbours(0)).toEqual({});
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
    expect(chapterFromHash('#10', NUMBERS, 1)).toBe(1);
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
