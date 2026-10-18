import { dbToAmp, keyOf } from '../../dsp/dx7';
import { chapterById } from '../../chapters';
import { DEFAULTS, dx7KernelLevelsAt, dx7NoteOf, type LabState, operatorLevelsAt, releaseSecondsOf } from '../../model/lab';

const sandbox = chapterById('sandbox')!;
const piano = sandbox.presets.find(p => p.label === 'E.PIANO 1')!.patch;
const state: LabState = { ...DEFAULTS, ...sandbox.patch, ...piano, chapter: 'sandbox', carrierHz: 261.63 };

describe('the sandbox\'s figures, following its DX7 voice', () => {
  it('show each operator as loud as its level at the key, between notes', () => {
    const levels = operatorLevelsAt({ ...state, noteStartedAt: null }, 0);
    expect(levels[0]).toBeCloseTo(dbToAmp(0), 9);
    expect(levels[1]).toBeCloseTo(dbToAmp(-30.75), 9);
    expect(levels[3]).toBeCloseTo(dbToAmp(-7.5), 9);
  });

  it('follow the envelopes through a note, and let go when the key does', () => {
    const struck = { ...state, noteStartedAt: 10, noteLength: Infinity, noteHold: Infinity };
    const early = operatorLevelsAt(struck, 10.05);
    const later = operatorLevelsAt(struck, 12);
    expect(later[1]).toBeLessThan(early[1]);
    const letGo = { ...struck, noteHold: 1, noteLength: 1 + releaseSecondsOf(struck) };
    // A tenth of a second after letting go, quieter than if still held.
    expect(operatorLevelsAt(letGo, 11.1)[0]).toBeLessThan(operatorLevelsAt(struck, 11.1)[0]);
  });

  it('give the spectrum the kernel\'s own levels', () => {
    const note = dx7NoteOf(state);
    expect(dx7KernelLevelsAt({ ...state, noteStartedAt: null }, 0)).toEqual(Array.from(note.gains));
    expect(keyOf(state.carrierHz)).toBeCloseTo(60, 2);
  });

  it('end a released note when its slowest operator has fallen silent', () => {
    expect(releaseSecondsOf(state)).toBeCloseTo(1.481, 9);
    expect(releaseSecondsOf({ ...state, voiceModel: 'basic' })).toBe(0.3);
  });
});
