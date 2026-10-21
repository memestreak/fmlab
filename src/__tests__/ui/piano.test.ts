import { chapterById, CHAPTERS } from '../../chapters';
import { hzToSemitones } from '../../model/lab';
import {
  FIRST_START,
  HIGHEST_KEY,
  isBlack,
  KEYS,
  LOWEST_KEY,
  letterForNote,
  midiToHz,
  noteForCode,
  noteName,
  OCTAVE_DOWN,
  OCTAVE_UP,
  playable,
  shiftStart,
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

  it('can be played from C1 to B6, every key the keyboard can show', () => {
    expect(LOWEST_KEY).toBe(24);
    expect(HIGHEST_KEY).toBe(95);
    expect(noteName(LOWEST_KEY)).toBe('C1');
    expect(noteName(HIGHEST_KEY)).toBe('B6');
    expect(playable(24)).toBe(true);
    expect(playable(95)).toBe(true);
    expect(playable(23)).toBe(false);
    expect(playable(96)).toBe(false);
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

  it('moves an octave at a time, from C1–B2 to C5–B6, and stops at its ends', () => {
    expect(STARTS.map(noteName)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5']);
    expect(shiftStart(48, -1)).toBe(36);
    expect(shiftStart(48, 1)).toBe(60);
    expect(shiftStart(24, -1)).toBe(24);
    expect(shiftStart(72, 1)).toBe(72);
    expect(shiftStart(36, -1)).toBe(24);
    expect(shiftStart(60, 1)).toBe(72);
  });

  it('can play every key it shows, wherever it is', () => {
    for (const start of STARTS) {
      const keys = Array.from({ length: KEYS }, (_, i) => start + i);
      expect(keys.every(playable)).toBe(true);
    }
  });
});

describe('the sandbox', () => {
  const sandbox = chapterById('sandbox')!;

  it('is the only chapter with the piano', () => {
    expect(CHAPTERS.filter(c => c.hasPiano).map(c => c.id)).toEqual(['sandbox']);
  });

  it('starts from the DX7\'s 32 factory voices, bank A, numbered, each marked as an approximation', () => {
    expect(sandbox.presetMenu).toBe(true);
    expect(sandbox.presets).toHaveLength(64);
    expect(sandbox.presets[0].label).toBe('A1 BRASS 1');
    expect(sandbox.presets[10].label).toBe('A11 E.PIANO 1');
    expect(sandbox.presets[31].label).toBe('A32 TAKE OFF');
    for (const preset of sandbox.presets.slice(0, 32)) {
      expect(preset.hint).toMatch(/^the DX7's factory .*, a close approximation/);
      expect(preset.note).toMatch(/^approximate/);
    }
    expect(sandbox.presets[10].hint).toContain('without its velocity');
    expect(sandbox.presets[10].note).toBe('approximate · no velocity');
    // The LFO is played now: STRINGS 2's vibrato, a delay of 1.18 s.
    expect(sandbox.presets[4].hint).not.toContain('vibrato');
    expect(sandbox.presets[4].patch.dxLfo).toMatchObject({ wave: 'sine', delay: 1.184 });
    // A fixed frequency is played as a ratio, and says so.
    expect(sandbox.presets[25].hint).toContain('fixed frequency (played as a ratio from middle C)');
  });
});
