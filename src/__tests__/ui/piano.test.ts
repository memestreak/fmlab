import { chapterByNumber, CHAPTERS } from '../../chapters';
import { hzToSemitones, RATIO } from '../../model/lab';
import {
  FIRST_START,
  isBlack,
  KEYS,
  letterForNote,
  midiToHz,
  noteForCode,
  noteName,
  OCTAVE_DOWN,
  OCTAVE_UP,
  playable,
  shiftStart,
  sounding,
  STARTS,
} from '../../ui/piano';

describe('notes', () => {
  it('are tuned to A4 = 440 Hz in equal temperament', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(57)).toBe(220);
    expect(midiToHz(60)).toBeCloseTo(261.626, 3);
  });

  it('are named as musicians write them', () => {
    expect(noteName(69)).toBe('A4');
    expect(noteName(60)).toBe('C4');
    expect(noteName(61)).toBe('C♯4');
    expect(noteName(48)).toBe('C3');
  });

  it('are black keys where a piano has them', () => {
    const octave = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59].map(isBlack);
    expect(octave).toEqual([false, true, false, true, false, false, true, false, true, false, true, false]);
  });

  it('can be played only inside the Carrier slider, A1 to A5', () => {
    expect(playable(33)).toBe(true);
    expect(playable(81)).toBe(true);
    expect(playable(32)).toBe(false);
    expect(playable(82)).toBe(false);
  });

  it('land exactly on the Carrier slider\'s steps', () => {
    // Its steps are quarter semitones from 55 Hz, A1.
    for (const midi of [33, 48, 57, 69, 81]) {
      expect(hzToSemitones(midiToHz(midi))).toBeCloseTo(midi - 33, 9);
    }
  });
});

describe('the computer\'s keys', () => {
  it('play the white notes along the home row from the keyboard\'s C', () => {
    const white = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'];
    expect(white.map(code => noteName(noteForCode(code, 48)!))).toEqual(
      ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'],
    );
  });

  it('play the black notes on the row above', () => {
    const black = ['KeyW', 'KeyE', 'KeyT', 'KeyY', 'KeyU'];
    expect(black.map(code => noteName(noteForCode(code, 48)!))).toEqual(
      ['C♯3', 'D♯3', 'F♯3', 'G♯3', 'A♯3'],
    );
  });

  it('follow the keyboard when it moves an octave', () => {
    expect(noteForCode('KeyA', 60)).toBe(60);
  });

  it('leave every other key alone', () => {
    expect(noteForCode('Space', 48)).toBeNull();
    expect(noteForCode('KeyQ', 48)).toBeNull();
    expect(noteForCode(OCTAVE_DOWN, 48)).toBeNull();
    expect(noteForCode(OCTAVE_UP, 48)).toBeNull();
  });

  it('are printed on the keys they play', () => {
    expect(letterForNote(48, 48)).toBe('A');
    expect(letterForNote(49, 48)).toBe('W');
    expect(letterForNote(64, 48)).toBe(';');
    expect(letterForNote(65, 48)).toBe("'");
    expect(letterForNote(66, 48)).toBeNull();
  });
});

describe('the keyboard', () => {
  it('shows two octaves from C3 to begin with', () => {
    expect(KEYS).toBe(24);
    expect(FIRST_START).toBe(48);
  });

  it('moves an octave at a time, and stops at its ends', () => {
    expect(shiftStart(48, -1)).toBe(36);
    expect(shiftStart(48, 1)).toBe(60);
    expect(shiftStart(36, -1)).toBe(36);
    expect(shiftStart(60, 1)).toBe(60);
  });

  it('has something to play wherever it is', () => {
    for (const start of STARTS) {
      const keys = Array.from({ length: KEYS }, (_, i) => start + i);
      expect(keys.filter(playable).length).toBeGreaterThan(12);
    }
  });

  it('plays the last key pressed, and falls back when it is let go', () => {
    expect(sounding([])).toBeNull();
    expect(sounding([60])).toBe(60);
    expect(sounding([60, 64])).toBe(64);
    // 64 let go, 60 still held:
    expect(sounding([60])).toBe(60);
  });
});

describe('the sandbox', () => {
  const sandbox = chapterByNumber(7)!;

  it('is the only chapter with the piano', () => {
    expect(CHAPTERS.filter(c => c.hasPiano).map(c => c.number)).toEqual([7]);
  });

  it('has presets for a ratio and an index each, inside the sliders', () => {
    expect(sandbox.presets.map(preset => preset.label)).toEqual(
      ['Flute', 'Brass', 'Clarinet', 'Bell', 'Gong', 'Bass'],
    );
    for (const { patch } of sandbox.presets) {
      expect(Object.keys(patch).sort()).toEqual(['index', 'ratio']);
      expect(patch.ratio!).toBeGreaterThanOrEqual(RATIO.min);
      expect(patch.ratio!).toBeLessThanOrEqual(RATIO.max);
    }
  });
});
