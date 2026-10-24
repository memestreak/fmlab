import { algorithm } from '../../dsp/algorithms';
import {
  dbToAmp,
  DEFAULT_VELOCITY,
  dx7Note,
  type Dx7Operator,
  FLAT_PITCH_ENVELOPE,
  FULL_INDEX,
  HELD_LFO,
  heldOperator,
  LIVE_GLIDE_SECONDS,
  VELOCITY_DATA,
  VELOCITY_STOPS,
  velocityDb,
} from '../../dsp/dx7';
import { type Dx7Patch, VoicePool } from '../../dsp/voicePool';

// Velocity, each operator's own, as the DX7 (Jeremy, 2026-10-24).

/**
 * msfa's ScaleVelocity (dx7note.cc), as the C source has it, in 1/32 of
 * an output level step (0.75 dB): the table, less 239, by the
 * sensitivity, rounded to 16.
 */
function msfaScaleVelocity(velocity: number, sensitivity: number): number {
  const clampedVel = Math.max(0, Math.min(127, velocity));
  const velValue = VELOCITY_DATA[clampedVel >> 1] - 239;
  const scaledVel = ((sensitivity * velValue + 7) >> 3) << 4;
  return scaledVel;
}
const msfaDb = (velocity: number, sensitivity: number) => (msfaScaleVelocity(velocity, sensitivity) / 32) * 0.75;

describe('velocity', () => {
  it('has msfa\'s table: 64 entries, 0 to 254, 240 at velocity 100', () => {
    expect(VELOCITY_DATA).toHaveLength(64);
    expect(VELOCITY_DATA[0]).toBe(0);
    expect(VELOCITY_DATA[63]).toBe(254);
    expect(VELOCITY_DATA[100 >> 1]).toBe(240);
  });

  it('has the DX7\'s eight steps as dB on the softest note, msfa\'s at velocity 1', () => {
    expect(VELOCITY_STOPS).toEqual([0, -10.9, -22.1, -33.4, -44.6, -55.9, -67.1, -78.4]);
    for (let s = 1; s <= 7; s++) expect(VELOCITY_STOPS[s]).toBeCloseTo(msfaDb(1, s), 1);
  });

  it('follows msfa\'s ScaleVelocity at every velocity and step, within its rounding', () => {
    for (let s = 1; s <= 7; s++) {
      for (let v = 1; v <= 127; v++) {
        // msfa rounds to 16/32 of a 0.75 dB step: 0.375 dB (0.34 at worst here).
        expect(Math.abs(velocityDb(v, VELOCITY_STOPS[s]) - msfaDb(v, s)), `step ${s}, velocity ${v}`).toBeLessThanOrEqual(0.375);
      }
    }
  });

  it('is nothing with no sensitivity, and under half a dB at velocity 100', () => {
    for (let v = 1; v <= 127; v++) expect(velocityDb(v, 0)).toBe(0);
    for (const softest of VELOCITY_STOPS) {
      expect(Math.abs(velocityDb(DEFAULT_VELOCITY, softest))).toBeLessThanOrEqual(0.4);
    }
    // The spec's table, msfa's figures (with its rounding): step 4 at velocity 1, 64 and 127.
    expect(msfaDb(1, 4)).toBeCloseTo(-44.625, 3);
    expect(msfaDb(64, 4)).toBeCloseTo(-6, 3);
    expect(msfaDb(127, 7)).toBeCloseTo(5.25, 3);
  });
});

describe('a note struck at a velocity', () => {
  // Algorithm 1: OP1 a carrier, OP2 its modulator.
  const op = (level: number, velocity: number): Dx7Operator => ({ ...heldOperator(1, level), velocity });
  const operators = [op(-6, -33.4), op(-12, -55.9), op(0, 0), op(0, 0), op(0, 0), op(0, 0)];
  const carrierUnit = 1 / algorithm(1).carriers.length;

  it('moves a carrier\'s gain and a modulator\'s index by velocityDb', () => {
    for (const v of [1, 64, 100, 127]) {
      const note = dx7Note(1, operators, 0, 60, v);
      expect(note.gains[0]).toBeCloseTo(carrierUnit * dbToAmp(-6 + velocityDb(v, -33.4)), 9);
      expect(note.gains[1]).toBeCloseTo(FULL_INDEX * dbToAmp(-12 + velocityDb(v, -55.9)), 9);
      // No sensitivity: as written whatever the velocity.
      expect(note.gains[2]).toBeCloseTo(carrierUnit * dbToAmp(0), 9);
    }
    // Softer, and darker as the modulator falls further.
    const soft = dx7Note(1, operators, 0, 60, 30);
    const hard = dx7Note(1, operators, 0, 60, 120);
    expect(soft.gains[0]).toBeLessThan(hard.gains[0]);
    expect(soft.gains[1] / hard.gains[1]).toBeLessThan(soft.gains[0] / hard.gains[0]);
  });

  it('goes a little over full at a hard velocity, as the DX7', () => {
    const full = dx7Note(1, [op(0, -78.4), ...operators.slice(1)], 0, 60, 127);
    expect(full.gains[0]).toBeGreaterThan(carrierUnit);
    expect(full.gains[0]).toBeCloseTo(carrierUnit * dbToAmp(velocityDb(127, -78.4)), 9);
  });

  it('is silent where the level would fall below silence', () => {
    const note = dx7Note(1, [op(-60, -78.4), ...operators.slice(1)], 0, 60, 1);
    expect(note.gains[0]).toBe(0);
  });

  it('defaults to velocity 100', () => {
    expect(Array.from(dx7Note(1, operators, 0, 60).gains)).toEqual(Array.from(dx7Note(1, operators, 0, 60, 100).gains));
  });

  it('as written, with no velocity (the figures between notes)', () => {
    const written = dx7Note(1, operators, 0, 60, null);
    expect(written.gains[0]).toBeCloseTo(carrierUnit * dbToAmp(-6), 9);
    expect(written.gains[1]).toBeCloseTo(FULL_INDEX * dbToAmp(-12), 9);
  });
});

describe('the voice pool, with velocity', () => {
  const SAMPLE_RATE = 48000;
  const patch = (level: number): Dx7Patch => ({
    kind: 'dx7',
    algorithm: 1,
    feedback: 0,
    operators: [0, 1, 2, 3, 4, 5].map(i => ({ ...heldOperator(1, i < 2 ? level : null), velocity: -44.6 })),
    lfo: HELD_LFO,
    pitchEnvelope: FLAT_PITCH_ENVELOPE,
  });
  const render = (voices: VoicePool, samples: number) => {
    const out = new Float32Array(128);
    for (let at = 0; at < samples; at += 128) voices.render(out);
  };
  const struck = (level: number, notes: [number, number, number][]) => {
    const voices = new VoicePool(4, SAMPLE_RATE, 0.05 * SAMPLE_RATE);
    voices.setPatch(patch(level));
    for (const [note, hz, velocity] of notes) voices.noteOn(note, hz, Infinity, velocity);
    render(voices, 4800);
    return voices;
  };

  it('strikes each note at its own velocity', () => {
    const voices = struck(-6, [[60, 261.63, 20], [64, 329.63, 120]]);
    const soft = voices.kernelLevelsOf(60)!;
    const hard = voices.kernelLevelsOf(64)!;
    expect(soft[0]).toBeLessThan(hard[0]);
    expect(soft[0] / hard[0]).toBeCloseTo(dbToAmp(velocityDb(20, -44.6) - velocityDb(120, -44.6)), 3);
  });

  it('keeps each note\'s velocity through a live edit', () => {
    const voices = struck(-6, [[60, 261.63, 20], [64, 329.63, 120]]);
    voices.setPatch(patch(-18), true);
    render(voices, 4 * LIVE_GLIDE_SECONDS * SAMPLE_RATE);
    // As if each had been struck at its velocity with the edited patch.
    const fresh = struck(-18, [[60, 261.63, 20], [64, 329.63, 120]]);
    render(fresh, 4 * LIVE_GLIDE_SECONDS * SAMPLE_RATE);
    for (const note of [60, 64]) {
      const heard = voices.kernelLevelsOf(note)!;
      const expected = fresh.kernelLevelsOf(note)!;
      heard.forEach((level, i) => expect(level).toBeCloseTo(expected[i], 6));
    }
  });
});
