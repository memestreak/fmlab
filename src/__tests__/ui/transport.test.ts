import { chapterByNumber, landing, LANDING } from '../../chapters';
import { DEFAULTS, type LabState, noteSounding } from '../../model/lab';
import { playLabel, pressPlay, spaceIsFree } from '../../ui/transport';

/** Chapter 6 as it opens: a 0.75 s brass note, none played yet. */
const brass: LabState = { ...DEFAULTS, ...chapterByNumber(6)!.patch, chapter: 6 };
/** The same with a note started at second 100 on the page's clock. */
const sounding: LabState = { ...brass, notes: 1, noteStartedAt: 100 };
const home: LabState = { ...DEFAULTS, ...landing.patch, chapter: LANDING };

describe('noteSounding', () => {
  it('is true from the moment a note is asked for until it is over', () => {
    expect(noteSounding(sounding, 99.99)).toBe(true);
    expect(noteSounding(sounding, 100.4)).toBe(true);
    expect(noteSounding(sounding, 100.75)).toBe(true);
    expect(noteSounding(sounding, 100.76)).toBe(false);
  });

  it('is false before any note', () => {
    expect(noteSounding(brass, 100)).toBe(false);
  });
});

// Jeremy, 2026-10-14: "I'd also like space bar to start/stop the audio."
describe('the main button and the space bar start and stop the sound', () => {
  it('start and stop a steady sound', () => {
    expect(pressPlay(DEFAULTS, 0)).toEqual({ playing: true });
    expect(pressPlay({ ...DEFAULTS, playing: true }, 0)).toEqual({ playing: false });
  });

  it('start a note when none is sounding', () => {
    expect(pressPlay(brass, 100)).toEqual({ notes: 1 });
    expect(pressPlay(sounding, 101)).toEqual({ notes: 2 });
  });

  it('stop a note that is sounding', () => {
    expect(pressPlay(sounding, 100.3)).toEqual({ stops: 1, noteStartedAt: null });
  });

  it('do the same on the landing view', () => {
    expect(pressPlay(home, 0)).toEqual({ notes: 1 });
    expect(pressPlay({ ...home, notes: 1, noteStartedAt: 10 }, 11)).toEqual({
      stops: 1,
      noteStartedAt: null,
    });
  });

  it('say what a press will do', () => {
    expect(playLabel(DEFAULTS, 0)).toBe('Play');
    expect(playLabel({ ...DEFAULTS, playing: true }, 0)).toBe('Stop');
    expect(playLabel(brass, 100)).toBe('Play note');
    expect(playLabel(sounding, 100.3)).toBe('Stop');
    expect(playLabel(sounding, 101)).toBe('Play note');
    expect(playLabel(home, 0)).toBe('Play');
    expect(playLabel({ ...home, noteStartedAt: 10 }, 11)).toBe('Stop');
  });
});

describe('where the space bar is left alone', () => {
  /** A stand-in element: all spaceIsFree asks is what `closest` finds. */
  const element = (matching: string[]) =>
    ({
      closest: (selectors: string) =>
        matching.some(tag => selectors.split(', ').includes(tag)) ? {} : null,
    }) as unknown as Element;

  it('is free on the page and on a slider, where space means nothing', () => {
    expect(spaceIsFree(null)).toBe(true);
    expect(spaceIsFree(element([]))).toBe(true);
  });

  it('is left to a button, a link, a checkbox, a maths panel and typing', () => {
    for (const tag of [
      'button',
      'a',
      'summary',
      'input[type="checkbox"]',
      'input[type="text"]',
      'textarea',
    ]) {
      expect(spaceIsFree(element([tag]))).toBe(false);
    }
  });

  it('is not kept from the Bessel plot, a slider with no use for space', () => {
    expect(spaceIsFree(element(['[role="slider"]']))).toBe(true);
  });
});
