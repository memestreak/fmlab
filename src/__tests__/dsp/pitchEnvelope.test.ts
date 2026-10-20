import {
  type Dx7PitchEnvelope,
  dx7PitchAt,
  FLAT_PITCH_ENVELOPE,
  glideSeconds,
  PITCH_EG_SPEED,
  pitchEnvelopeOn,
} from '../../dsp/dx7';

// Up a fifth from the note at 1200 ¢/s, then down an octave below it at
// 600 ¢/s, up to a whole tone below at 2400 ¢/s, held; back to the start
// at 300 ¢/s once let go.
const env: Dx7PitchEnvelope = {
  start: 0,
  attack: 1200,
  peak: 700,
  decay1: 600,
  brk: -1200,
  decay2: 2400,
  sustain: -200,
  release: 300,
};
// Each part takes its distance over its speed.
const ATTACK = 700 / 1200;
const DECAY1 = 1900 / 600;
const DECAY2 = 1000 / 2400;

describe('the pitch envelope', () => {
  it('starts at its start, and reaches each level as each part ends', () => {
    expect(dx7PitchAt(env, 0)).toBe(0);
    expect(dx7PitchAt(env, ATTACK)).toBeCloseTo(700, 9);
    expect(dx7PitchAt(env, ATTACK + DECAY1)).toBeCloseTo(-1200, 9);
    expect(dx7PitchAt(env, ATTACK + DECAY1 + DECAY2)).toBeCloseTo(-200, 9);
    // Halfway through the attack, halfway there.
    expect(dx7PitchAt(env, ATTACK / 2)).toBeCloseTo(350, 9);
  });

  it('holds at the sustain while the key is down', () => {
    expect(dx7PitchAt(env, 30)).toBe(-200);
    expect(dx7PitchAt(env, 30, 40)).toBe(-200);
  });

  it('glides back to the start at the release speed once let go', () => {
    // From the sustain: 200 ¢ at 300 ¢/s.
    const hold = 10;
    expect(dx7PitchAt(env, hold + 1 / 3, hold)).toBeCloseTo(-100, 9);
    expect(dx7PitchAt(env, hold + 2 / 3, hold)).toBeCloseTo(0, 9);
    expect(dx7PitchAt(env, hold + 5, hold)).toBe(0);
  });

  it('glides back from wherever it had got to, mid-attack, at the same speed', () => {
    // Let go a quarter second in, at 300 ¢: 300 ¢ back at 300 ¢/s takes a second.
    const hold = 0.25;
    expect(dx7PitchAt(env, hold, hold)).toBeCloseTo(300, 9);
    expect(dx7PitchAt(env, hold + 0.5, hold)).toBeCloseTo(150, 9);
    expect(dx7PitchAt(env, hold + 1, hold)).toBeCloseTo(0, 9);
  });

  it('takes no time over a part that does not move', () => {
    const still: Dx7PitchEnvelope = { ...env, peak: 0, attack: PITCH_EG_SPEED.min };
    expect(glideSeconds(0, 0, PITCH_EG_SPEED.min)).toBe(0);
    // Straight into decay 1, however slow the attack.
    expect(dx7PitchAt(still, 0.5)).toBeCloseTo(-300, 9);
  });

  it('is flat, and off, at its default', () => {
    expect(pitchEnvelopeOn(FLAT_PITCH_ENVELOPE)).toBe(false);
    expect(pitchEnvelopeOn(env)).toBe(true);
    expect(dx7PitchAt(FLAT_PITCH_ENVELOPE, 1)).toBe(0);
  });

  it('runs at msfa\'s speeds, about 0.56 to 144 semitones a second', () => {
    expect(PITCH_EG_SPEED.min / 100).toBeCloseTo(0.56, 2);
    expect(PITCH_EG_SPEED.max / 100).toBeCloseTo(143.7, 1);
  });
});
