import {
  chapterByNumber,
  CHAPTERS,
  landing,
  LANDING,
  neighbours,
} from '../../chapters';
import { chapterFromHash, isStrayHash } from '../../chapters/route';
import { envelopeAt, noteSeconds } from '../../dsp/envelope';
import {
  DEFAULTS,
  envelopeOf,
  type LabState,
  momentOf,
} from '../../model/lab';
import { noteHasPlayhead } from '../../ui/figures';
import { playLabel, pressPlay } from '../../ui/transport';
import { spectrumOf } from '../../viz/spectrumPlot';

/**
 * A state with a note started at `at` on the page's clock, as the engine
 * leaves it: with the note's length fixed from the patch at that moment.
 */
const started = (state: LabState, at: number): LabState => ({
  ...state,
  noteStartedAt: at,
  noteLength: noteSeconds(envelopeOf(state)),
});

const NUMBERS = CHAPTERS.map(chapter => chapter.number);
/** The landing view as the site opens on it. */
const opened: LabState = { ...DEFAULTS, chapter: LANDING, ...landing.patch };
/** The same with its note started at second 100 on the page's clock. */
const sounding: LabState = started({ ...opened, notes: 1 }, 100);

describe('where the site opens', () => {
  it('is the landing view when the address names no chapter', () => {
    expect(chapterFromHash('', NUMBERS, LANDING)).toBe(LANDING);
    expect(chapterFromHash('#', NUMBERS, LANDING)).toBe(LANDING);
  });

  it('is still a chapter when the address names one', () => {
    for (const number of NUMBERS) {
      expect(chapterFromHash(`#${number}`, NUMBERS, LANDING)).toBe(number);
    }
  });

  it('is the landing view for a number with no chapter, even its own', () => {
    expect(chapterFromHash('#10', NUMBERS, LANDING)).toBe(LANDING);
    // The landing view has no address of its own: "#0" is a stray.
    expect(chapterFromHash('#0', NUMBERS, LANDING)).toBe(LANDING);
    expect(isStrayHash('#0', NUMBERS)).toBe(true);
  });

  it('takes out of the address bar a hash that names nothing', () => {
    expect(isStrayHash('#10', NUMBERS)).toBe(true);
    expect(isStrayHash('#chapter-two', NUMBERS)).toBe(true);
  });

  it('leaves a chapter\'s hash, and no hash, alone', () => {
    expect(isStrayHash('#3', NUMBERS)).toBe(false);
    expect(isStrayHash('', NUMBERS)).toBe(false);
    expect(isStrayHash('#', NUMBERS)).toBe(false);
  });
});

describe('the landing view', () => {
  it('is not one of the guide\'s chapters', () => {
    expect(NUMBERS).not.toContain(LANDING);
    expect(CHAPTERS).not.toContain(landing);
    expect(neighbours(LANDING)).toEqual({});
  });

  it('is found by its number all the same', () => {
    expect(chapterByNumber(LANDING)).toBe(landing);
  });

  it('is one line, the waveform and the spectrum, and a volume slider', () => {
    expect(landing.body).toHaveLength(1);
    expect(landing.maths).toEqual([]);
    expect(Object.keys(landing.figures)).toEqual(['waveform', 'spectrum']);
    expect(landing.controls).toEqual(['volume']);
    expect(landing.presets).toEqual([]);
  });

  it('says Play, and a press plays its one sound', () => {
    expect(playLabel(opened, 0)).toBe('Play');
    expect(pressPlay(opened, 0)).toEqual({ notes: 1 });
  });

  it('plays a few seconds: a swell on 1:1 that gives its harmonics back', () => {
    expect(opened.noteMode).toBe(true);
    expect(opened.ratio).toBe(1);
    expect(opened.indexFollows).toBe(true);
    const seconds = noteSeconds(envelopeOf(opened));
    expect(seconds).toBeGreaterThan(3);
    expect(seconds).toBeLessThan(6);
    // Slow enough to hear the partials arrive one after another.
    expect(opened.attack).toBeGreaterThan(1);
  });
});

describe('the figures following the landing view\'s sound', () => {
  it('show the sound at its fullest before it is played', () => {
    expect(momentOf(opened, undefined)).toEqual({ index: 6, level: 1 });
    expect(momentOf(opened, 50)).toEqual({ index: 6, level: 1 });
    expect(spectrumOf(opened).length).toBeGreaterThan(6);
  });

  it('start from a bare, quiet sine wave when it is played', () => {
    const early = momentOf(sounding, 100.05);
    expect(early.index).toBeLessThan(0.3);
    expect(early.level).toBeLessThan(0.05);
    // Nearly all carrier: the next partial is a tenth of it or less.
    const lines = spectrumOf(sounding, 100.05);
    const carrier = lines.find(line => line.freq === 1)!;
    for (const line of lines) {
      if (line !== carrier) {
        expect(Math.abs(line.amp)).toBeLessThan(Math.abs(carrier.amp) / 9);
      }
    }
  });

  it('follow the index and the loudness through the note', () => {
    const envelope = envelopeOf(opened);
    for (const into of [0.4, 1.6, 2.5, 3.9]) {
      const { index, level } = momentOf(sounding, 100 + into);
      expect(level).toBeCloseTo(envelopeAt(envelope, into), 12);
      expect(index).toBeCloseTo(6 * envelopeAt(envelope, into), 12);
    }
  });

  it('grow partials on the way up and lose them on the way down', () => {
    const count = (into: number) => spectrumOf(sounding, 100 + into).length;
    expect(count(1.6)).toBeGreaterThan(count(0.3));
    expect(count(1.6)).toBeGreaterThan(count(4.2));
  });

  it('scale every stem by the loudness of the moment', () => {
    const loudest = (lines: { amp: number }[]) =>
      Math.max(...lines.map(line => Math.abs(line.amp)));
    // Late in the release the note is nearly gone, and so are the stems.
    expect(loudest(spectrumOf(sounding, 104.2))).toBeLessThan(0.1);
    expect(loudest(spectrumOf(sounding, 101.6))).toBeGreaterThan(0.3);
  });

  it('go back to the sound at its fullest when the note is over', () => {
    expect(momentOf(sounding, 100 + 10)).toEqual({ index: 6, level: 1 });
  });

  it('stay still for someone who asked for reduced motion, sound or no', () => {
    expect(noteHasPlayhead(sounding, 101, true)).toBe(false);
    expect(noteHasPlayhead(sounding, 101, false)).toBe(true);
  });

  it('leave a steady patch alone whatever the time', () => {
    const steady: LabState = started({ ...DEFAULTS }, 100);
    expect(momentOf(steady, 101)).toEqual({ index: 2, level: 1 });
  });
});
