import {
  chapterById,
  CHAPTERS,
  FIRST_CHAPTER,
  neighbours,
} from '../../chapters';
import { OUTLINE, SECTION_IDS } from '../../chapters/outline';
import { hashFor, upgradeHash, viewFromHash } from '../../chapters/route';
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

const IDS = CHAPTERS.map(chapter => chapter.id);
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
  it('are in the outline\'s order, each with its own address', () => {
    expect(IDS).toEqual(SECTION_IDS);
    expect(new Set(IDS).size).toBe(IDS.length);
    expect(FIRST_CHAPTER).toBe('sine');
    for (const id of IDS) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('are in four named groups, the sandbox last', () => {
    expect(OUTLINE.map(g => [g.group, g.sections.map(s => s.id)])).toEqual([
      ['Basics', ['sine', 'vibrato']],
      ['Two operators', ['index', 'sidebands', 'ratio', 'envelopes']],
      ['The DX7', ['algorithms', 'fm-vs-pm']],
      ['Play', ['sandbox']],
    ]);
    expect(CHAPTERS.map(c => c.title)).toEqual([
      'A single sine',
      'Vibrato becomes tone',
      'The modulation index',
      'Sidebands and Bessel functions',
      'Carrier and modulator ratio',
      'Sounds that change over time',
      'Operators and algorithms',
      'FM versus PM',
      'Sandbox',
    ]);
  });

  it.each(CHAPTERS)('$title says no chapter numbers', chapter => {
    const text = [
      ...chapter.body,
      ...(chapter.steps ?? []).flatMap(step => [step.title, ...step.body]),
      ...chapter.maths.flatMap(panel => [panel.title, ...panel.body]),
      ...Object.values(chapter.figures),
    ].join(' ');
    expect(text).not.toMatch(/\bchapters?\s+\d/i);
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

  it.each(CHAPTERS)('$title has text and a title', chapter => {
    expect(chapter.title).not.toBe('');
    if (chapter.instrument) {
      // An instrument page: no lesson, a line beside its title instead.
      expect(chapter.body).toEqual([]);
      expect(chapter.maths).toEqual([]);
      expect(chapter.lede?.trim()).toBeTruthy();
      expect(chapter.sixOperators?.lede?.trim()).toBeTruthy();
      return;
    }
    expect(chapter.body.length).toBeGreaterThan(0);
    expect(chapter.body.every(text => text.trim().length > 0)).toBe(true);
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
    const { patch, controls } = chapterById('vibrato')!;
    expect(patch.mode).toBe('fm');
    expect(patch.modHz).toBeLessThan(10);
    expect(patch.deviationHz).toBeGreaterThan(0);
    expect(controls).toEqual(['volume', 'modHz', 'deviation']);
  });

  it('is the only chapter in true FM', () => {
    expect(CHAPTERS.filter(c => c.patch.mode === 'fm').map(c => c.id)).toEqual(['vibrato']);
  });
});

describe('chapter 3, modulation index', () => {
  const chapter = chapterById('index')!;

  it('holds the ratio at 1 and offers only the index', () => {
    expect(chapter.patch.mode).toBe('pm');
    expect(chapter.patch.ratio).toBe(1);
    expect(chapter.controls).toEqual(['volume', 'index']);
  });

  it("brackets Carson's rule on its spectrum, and is the only one to", () => {
    expect(chapter.patch.showBandwidth).toBe(true);
    expect(CHAPTERS.filter(c => c.patch.showBandwidth).map(c => c.id)).toEqual(['index']);
  });
});

describe('chapter 4, Bessel functions', () => {
  const chapter = chapterById('sidebands')!;

  it('is the only chapter with the Bessel plot, beside the spectrum', () => {
    expect(Object.keys(chapter.figures)).toEqual(['spectrum', 'bessel']);
    expect(CHAPTERS.filter(c => c.figures.bessel).map(c => c.id)).toEqual(['sidebands']);
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
    expect(neighbours('sine').previous).toBeUndefined();
    expect(neighbours('sandbox').next).toBeUndefined();
  });

  it('are the sections either side, across groups', () => {
    expect(neighbours('vibrato').previous?.id).toBe('sine');
    expect(neighbours('vibrato').next?.id).toBe('index');
    expect(neighbours('envelopes').next?.id).toBe('algorithms');
    expect(neighbours('sandbox').previous?.id).toBe('fm-vs-pm');
  });

  it('has none for what is not a section', () => {
    expect(neighbours('landing')).toEqual({});
    expect(neighbours('glossary')).toEqual({});
    expect(neighbours('nowhere')).toEqual({});
  });
});

describe('viewFromHash', () => {
  it('reads a section\'s address', () => {
    expect(viewFromHash('#/sine', IDS, 'landing')).toBe('sine');
    expect(viewFromHash('#/fm-vs-pm', IDS, 'landing')).toBe('fm-vs-pm');
    expect(viewFromHash('#/sandbox?c=220', IDS, 'landing')).toBe('sandbox');
  });

  it('is the landing view at "#/", and the glossary at its own', () => {
    expect(viewFromHash('#/', IDS, 'x')).toBe('landing');
    expect(viewFromHash('#/glossary?t=index', IDS, 'x')).toBe('glossary');
  });

  it('falls back when there is no hash, or one that names nothing', () => {
    for (const hash of ['', '#', '#/nowhere', '#sine', '#/Sine', '#//sine', '#/sine/2']) {
      expect(viewFromHash(hash, IDS, 'fallback')).toBe('fallback');
    }
  });

  it('reads back what hashFor writes', () => {
    for (const id of IDS) {
      expect(viewFromHash(hashFor(id), IDS, 'x')).toBe(id);
    }
    expect(hashFor('landing')).toBe('#/');
    expect(hashFor('sandbox', 'c=220')).toBe('#/sandbox?c=220');
  });
});

describe('old links', () => {
  it('go to the section their number meant, keeping what follows', () => {
    expect(upgradeHash('#1')).toBe('#/sine');
    expect(upgradeHash('#4')).toBe('#/sidebands');
    expect(upgradeHash('#6')).toBe('#/envelopes');
    expect(upgradeHash('#8')).toBe('#/algorithms');
    expect(upgradeHash('#9')).toBe('#/fm-vs-pm');
    expect(upgradeHash('#7?c=220&r=1.41&i=5')).toBe('#/sandbox?c=220&r=1.41&i=5');
    expect(upgradeHash('#7?m=6&a=5')).toBe('#/sandbox?m=6&a=5');
    expect(upgradeHash('#glossary')).toBe('#/glossary');
    expect(upgradeHash('#glossary?t=index')).toBe('#/glossary?t=index');
    expect(upgradeHash('#0')).toBe('#/');
  });

  it('leave everything else alone', () => {
    for (const hash of ['', '#', '#10', '#99', '#/sine', '#two', '#2a']) {
      expect(upgradeHash(hash)).toBeNull();
    }
  });
});
