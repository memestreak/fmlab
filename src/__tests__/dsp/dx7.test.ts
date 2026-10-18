import {
  ampToDb,
  dbToIndex,
  detuned,
  type Dx7Envelope,
  dx7EnvelopeAt,
  dx7Note,
  type Dx7Operator,
  dx7RateSpeed,
  FULL_INDEX,
  levelAtKey,
  levelScalingDb,
  rateScalingFactor,
  releaseSeconds,
  SILENCE_DB,
  stageEnds,
} from '../../dsp/dx7';
import { PmKernel } from '../../dsp/pmKernel';

/** msfa's depth 0 to 99 in fmlab's dB per three semitones. */
const depth = (dx7: number) => ((dx7 * 329) / 4096) * 0.75;
/** msfa's output-level steps, 0.75 dB each, as dB. */
const steps = (n: number) => n * 0.75;

const env: Dx7Envelope = {
  attack: 0.1,
  peak: 0,
  decay1: 0.2,
  brk: -12,
  decay2: 0.5,
  sustain: -24,
  release: 1,
};

const operator = (o: Partial<Dx7Operator> = {}): Dx7Operator => ({
  ratio: 1,
  detune: 0,
  level: 0,
  envelope: env,
  breakKey: 60,
  left: { curve: 'lin', depth: 0 },
  right: { curve: 'lin', depth: 0 },
  rateScaling: 1,
  ...o,
});

describe('a DX7 level', () => {
  it('gives a modulator msfa\'s index: two cycles each way, 4π, at full level', () => {
    expect(FULL_INDEX).toBeCloseTo(12.566, 3);
    expect(dbToIndex(0)).toBeCloseTo(4 * Math.PI, 12);
    // Each 6 dB down halves it; 20 dB down is a tenth.
    expect(dbToIndex(-20 * Math.log10(2))).toBeCloseTo(2 * Math.PI, 12);
    expect(dbToIndex(-20)).toBeCloseTo((4 * Math.PI) / 10, 12);
    expect(dbToIndex(SILENCE_DB)).toBe(0);
  });

  it('is never above full, scaled or not, and nothing when off', () => {
    const loud = operator({ level: -3, right: { curve: 'lin', depth: depth(99) } });
    expect(levelAtKey(loud, 84)).toBe(0);
    expect(levelAtKey(operator({ level: null }), 60)).toBeNull();
  });
});

describe('a DX7 envelope', () => {
  it('reaches each level as each part ends', () => {
    const ends = stageEnds(env);
    expect(ends).toEqual({ attack: 0.1, decay1: 0.30000000000000004, decay2: 0.8 });
    expect(dx7EnvelopeAt(env, 0)).toBe(0);
    expect(dx7EnvelopeAt(env, 0.05)).toBeCloseTo(0.5, 12);
    expect(ampToDb(dx7EnvelopeAt(env, ends.attack))).toBeCloseTo(0, 9);
    expect(ampToDb(dx7EnvelopeAt(env, ends.decay1))).toBeCloseTo(-12, 9);
    expect(ampToDb(dx7EnvelopeAt(env, ends.decay2))).toBeCloseTo(-24, 9);
    // Held at the sustain for as long as the key is.
    expect(ampToDb(dx7EnvelopeAt(env, 30))).toBeCloseTo(-24, 9);
  });

  it('decays in straight lines in dB', () => {
    expect(ampToDb(dx7EnvelopeAt(env, 0.2))).toBeCloseTo(-6, 9);
    expect(ampToDb(dx7EnvelopeAt(env, 0.55))).toBeCloseTo(-18, 9);
  });

  it('releases at the speed that falls from full to silence in its release time', () => {
    // From the sustain, -24 dB: 72 dB to go at 96 dB a second.
    expect(releaseSeconds(env, -24)).toBeCloseTo(0.75, 12);
    expect(ampToDb(dx7EnvelopeAt(env, 2 + 0.25, 2))).toBeCloseTo(-48, 9);
    expect(dx7EnvelopeAt(env, 2 + 0.76, 2)).toBe(0);
  });

  // Let go mid-attack, mid-decay and while sustaining: no jump.
  it.each([0.05, 0.2, 0.55, 3])('is continuous when let go at %s s', at => {
    const held = dx7EnvelopeAt(env, at);
    expect(dx7EnvelopeAt(env, at, at)).toBeCloseTo(held, 12);
    expect(dx7EnvelopeAt(env, at + 1e-6, at)).toBeCloseTo(held, 4);
    expect(dx7EnvelopeAt(env, at + 0.01, at)).toBeLessThan(held);
  });
});

describe('DX7 rates', () => {
  it('have msfa\'s speeds', () => {
    // q = floor(rate × 41 / 64); 0.0633 × (4 + q mod 4) × 2^floor(q / 4) dB a second.
    expect(dx7RateSpeed(99)).toBeCloseTo(14519, -1);
    expect(dx7RateSpeed(50)).toBeCloseTo(64.8, 1);
    expect(dx7RateSpeed(25)).toBeCloseTo(4.05, 2);
  });
});

describe('rate scaling', () => {
  it('runs an envelope faster up the keyboard, as msfa\'s ScaleRate does', () => {
    // Middle C with sensitivity 7: x = 60 / 3 - 7 = 13, q += (7 × 13) >> 3 = 11,
    // and the speed doubles every four q: 2^(11 / 4), about 6.7. fmlab
    // leaves out msfa's rounding to whole q, so within a quarter step.
    const perOctave = 2 ** (7 / 8);
    expect(rateScalingFactor(perOctave, 60) / 2 ** (11 / 4)).toBeGreaterThan(1);
    expect(rateScalingFactor(perOctave, 60) / 2 ** (11 / 4)).toBeLessThan(2 ** (1 / 4) + 1e-9);
    // An octave up runs about 2^(7/8) faster again.
    expect(rateScalingFactor(perOctave, 72) / rateScalingFactor(perOctave, 60)).toBeCloseTo(perOctave, 9);
    // Nothing at the bottom, nor with no scaling.
    expect(rateScalingFactor(perOctave, 21)).toBe(1);
    expect(rateScalingFactor(1, 96)).toBe(1);
  });
});

describe('level scaling', () => {
  const at = (side: 'left' | 'right', curve: 'lin' | 'exp', dx7Depth: number, sign: 1 | -1, key: number) =>
    levelScalingDb(
      {
        breakKey: 60,
        left: side === 'left' ? { curve, depth: sign * depth(dx7Depth) } : { curve: 'lin', depth: 0 },
        right: side === 'right' ? { curve, depth: sign * depth(dx7Depth) } : { curve: 'lin', depth: 0 },
      },
      key,
    );

  it('does nothing at the break point', () => {
    expect(at('right', 'lin', 99, 1, 60)).toBe(0);
    expect(at('left', 'lin', 99, -1, 59)).toBe(-0);
  });

  it('grows linearly, about 6 dB per three keys at full depth', () => {
    // Twelve keys up: group (12 + 1) / 3 = 4, and (4 × 99 × 329) >> 12 = 31 steps.
    expect(Math.abs(at('right', 'lin', 99, 1, 72) - steps(31))).toBeLessThan(0.75);
    // Twelve keys down, quieter, depth 50: group (1 + 12) / 3 = 4, (4 × 50 × 329) >> 12 = 16.
    expect(Math.abs(at('left', 'lin', 50, -1, 48) - -steps(16))).toBeLessThan(0.75);
  });

  it('grows slowly, then steeply, on the exponential curve', () => {
    // 24 keys up: group 8, exp_scale_data[8] = 8, (8 × 99 × 329) >> 15 = 7 steps.
    expect(Math.abs(at('right', 'exp', 99, 1, 84) - steps(7))).toBeLessThan(0.75);
    // 48 keys up: group 16, 33, (33 × 99 × 329) >> 15 = 32 steps.
    expect(Math.abs(at('right', 'exp', 99, 1, 108) - steps(32))).toBeLessThan(0.75);
  });
});

describe('detune', () => {
  it('beats two carriers at the rate the cents give', () => {
    // 7 cents sharp on 440 Hz: 440 × (2^(7/1200) - 1), about 1.78 beats a second.
    const expected = 440 * (detuned(1, 7) - 1);
    expect(expected).toBeCloseTo(1.78, 2);

    const rate = 8000;
    const silent = operator({ level: null });
    const note = dx7Note(
      32,
      [operator(), operator({ detune: 7 }), silent, silent, silent, silent],
      0,
      69,
    );
    const kernel = new PmKernel(note.alg, 0.05 * rate);
    // How loud each 10 ms is, over 3 seconds.
    const window = rate / 100;
    const loudness: number[] = [];
    let sum = 0;
    for (let i = 1; i <= rate * 3; i++) {
      const sample = kernel.tick(440 / rate, note.ratios, note.gains, 0);
      sum += sample * sample;
      if (i % window === 0) {
        loudness.push(Math.sqrt(sum / window));
        sum = 0;
      }
    }
    // The quiet moments, where the two cancel: their spacing is the beat.
    const quiet = loudness
      .map((value, i) => ({ value, i }))
      .filter(({ value, i }) => i > 0 && i < loudness.length - 1 && value < 0.1 && value <= loudness[i - 1] && value <= loudness[i + 1])
      .map(({ i }) => i);
    expect(quiet.length).toBeGreaterThanOrEqual(4);
    const spacing = (quiet[quiet.length - 1] - quiet[0]) / (quiet.length - 1) / 100;
    expect(1 / spacing).toBeCloseTo(expected, 1);
  });
});
