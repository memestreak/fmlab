import { algorithm } from '../../dsp/algorithms';
import { dx7EnvelopeAt, dx7Note, heldOperator } from '../../dsp/dx7';
import { envelopeAt } from '../../dsp/envelope';
import { kernelLevels, type Operator, operatorEnvelope } from '../../dsp/operators';
import { MAX_OPERATORS, PmKernel } from '../../dsp/pmKernel';
import { type Dx7Patch, STEAL_SECONDS, VoicePool, type VoicePatch } from '../../dsp/voicePool';

const SAMPLE_RATE = 48000;
const LOCK_SAMPLES = 0.05 * SAMPLE_RATE;

const op = (ratio: number, level: number, decay = 0): Operator => ({ ratio, level, decay });
/** Algorithm 1, two stacks, with a decay on the tall one. */
const STACKS: VoicePatch = {
  algorithm: 1,
  feedback: 0.5,
  operators: [op(1, 1), op(2, 0.4), op(1, 0.8, 1.5), op(3, 0.3, 1), op(1, 0.25), op(1, 0.2)],
};
/** Algorithm 32: six carriers, no modulation, all held. */
const ORGAN: VoicePatch = {
  algorithm: 32,
  feedback: 0,
  operators: [op(0.5, 0.8), op(1, 1), op(2, 0.7), op(3, 0.5), op(4, 0.4), op(6, 0.3)],
};

function pool(count: number, patch: VoicePatch): VoicePool {
  const voices = new VoicePool(count, SAMPLE_RATE, LOCK_SAMPLES);
  voices.setPatch(patch);
  return voices;
}

function render(voices: VoicePool, samples: number): Float32Array {
  const out = new Float32Array(samples);
  // In blocks of 128, as the worklet renders.
  for (let at = 0; at < samples; at += 128) voices.render(out.subarray(at, Math.min(samples, at + 128)));
  return out;
}

/** The biggest jump from one sample to the next. */
const steepest = (out: Float32Array) => {
  let most = 0;
  for (let i = 1; i < out.length; i++) most = Math.max(most, Math.abs(out[i] - out[i - 1]));
  return most;
};

describe('the voice pool', () => {
  it('with one voice plays exactly what one kernel would', () => {
    const voices = pool(1, STACKS);
    voices.noteOn(60, 261.63);
    const heard = render(voices, 4800);

    const alg = algorithm(STACKS.algorithm);
    const kernel = new PmKernel(alg, LOCK_SAMPLES);
    const envelopes = STACKS.operators.map(o => operatorEnvelope(o, Infinity));
    const ratios = STACKS.operators.map(o => o.ratio);
    const levels = new Float64Array(MAX_OPERATORS);
    const scaled = new Float64Array(MAX_OPERATORS);
    for (let i = 0; i < heard.length; i++) {
      STACKS.operators.forEach((o, n) => {
        levels[n] = o.level * envelopeAt(envelopes[n], i / SAMPLE_RATE);
      });
      const expected = kernel.tick(261.63 / SAMPLE_RATE, ratios, kernelLevels(alg, levels, scaled), STACKS.feedback);
      expect(heard[i]).toBe(Math.fround(expected));
    }
  });

  it('sounds several notes at once, each as it would alone', () => {
    const chord = pool(8, ORGAN);
    chord.noteOn(60, 261.63);
    chord.noteOn(64, 329.63);
    const both = render(chord, 2400);
    const alone = (note: number, hz: number) => {
      const one = pool(8, ORGAN);
      one.noteOn(note, hz);
      return render(one, 2400);
    };
    const c = alone(60, 261.63);
    const e = alone(64, 329.63);
    for (let i = 0; i < both.length; i++) expect(both[i]).toBeCloseTo(c[i] + e[i], 5);
    expect(chord.active).toBe(2);
  });

  it('holds a note for as long as its key is down', () => {
    const organ = pool(8, ORGAN);
    organ.noteOn(60, 261.63);
    render(organ, SAMPLE_RATE * 10);
    const later = render(organ, 4800);
    expect(Math.max(...later.map(Math.abs))).toBeGreaterThan(0.3);
  });

  it('lets a note go smoothly, and frees its voice once it has died away', () => {
    const organ = pool(8, ORGAN);
    organ.noteOn(60, 261.63);
    const held = render(organ, 2400);
    organ.noteOff(60);
    const letGo = render(organ, SAMPLE_RATE);
    // No step where it is let go: no bigger than the steepest of the note.
    expect(Math.abs(letGo[0] - held[held.length - 1])).toBeLessThanOrEqual(steepest(held) * 1.01);
    expect(Math.max(...letGo.slice(-480).map(Math.abs))).toBeLessThan(1e-3);
    render(organ, SAMPLE_RATE);
    expect(organ.active).toBe(0);
  });

  it('frees a voice whose carriers have died away, held or not', () => {
    const dying = pool(8, {
      algorithm: 32,
      feedback: 0,
      operators: Array.from({ length: 6 }, () => op(1, 0.5, 0.2)),
    });
    dying.noteOn(60, 261.63);
    render(dying, SAMPLE_RATE);
    expect(dying.active).toBe(0);
  });

  it('lets go of a note given a length by itself', () => {
    const organ = pool(8, ORGAN);
    organ.noteOn(128, 220, 0.5);
    render(organ, SAMPLE_RATE * 2);
    expect(organ.active).toBe(0);
  });

  it('strikes a key again on its own voice, without a click', () => {
    const organ = pool(8, ORGAN);
    organ.noteOn(60, 261.63);
    const before = render(organ, 2400);
    organ.noteOn(60, 261.63);
    const again = render(organ, 2400);
    expect(organ.active).toBe(1);
    expect(steepest(again)).toBeLessThanOrEqual(steepest(before) * 1.01);
  });

  it('takes a voice for a ninth note, faded out first so there is no click', () => {
    const organ = pool(8, ORGAN);
    for (let n = 0; n < 8; n++) organ.noteOn(60 + n, 261.63 * 2 ** (n / 12));
    const full = render(organ, 2400);
    organ.noteOn(72, 523.25);
    const stolen = render(organ, Math.round(STEAL_SECONDS * SAMPLE_RATE) + 2400);
    expect(organ.active).toBe(8);
    expect(steepest(stolen)).toBeLessThanOrEqual(steepest(full) * 1.25);
  });

  it('is silenced by all off', () => {
    const organ = pool(8, ORGAN);
    organ.noteOn(60, 261.63);
    organ.noteOn(67, 392);
    render(organ, 2400);
    organ.allOff();
    render(organ, Math.round(STEAL_SECONDS * SAMPLE_RATE) + 1);
    const after = render(organ, 480);
    expect(after.every(sample => sample === 0)).toBe(true);
    expect(organ.active).toBe(0);
  });

  it('takes up a new patch with the next note, not the one sounding', () => {
    const voices = pool(8, ORGAN);
    voices.noteOn(60, 261.63);
    voices.setPatch({ ...ORGAN, operators: ORGAN.operators.map(o => ({ ...o, level: 0 })) });
    expect(Math.max(...render(voices, 2400).map(Math.abs))).toBeGreaterThan(0.3);
  });
});

describe('the voice pool, playing a DX7 voice', () => {
  const held = (ratio: number, level: number | null) => heldOperator(ratio, level);
  const organ: Dx7Patch = {
    kind: 'dx7',
    algorithm: 32,
    feedback: 0,
    operators: [held(1, 0), held(2, -6), held(3, null), held(4, null), held(5, null), held(6, null)],
  };

  it('with one voice plays exactly what dx7Note and the kernel give', () => {
    const voices = new VoicePool(1, SAMPLE_RATE, LOCK_SAMPLES);
    voices.setPatch(organ);
    voices.noteOn(69, 440);
    const heard = render(voices, 2400);
    const note = dx7Note(32, organ.operators, 0, 69);
    const kernel = new PmKernel(note.alg, LOCK_SAMPLES);
    const scaled = new Float64Array(MAX_OPERATORS);
    for (let i = 0; i < heard.length; i++) {
      for (let op = 0; op < MAX_OPERATORS; op++) {
        scaled[op] = note.gains[op] * dx7EnvelopeAt(note.envelopes[op], i / SAMPLE_RATE);
      }
      expect(heard[i]).toBe(Math.fround(kernel.tick(440 / SAMPLE_RATE, note.ratios, scaled, 0)));
    }
  });

  it('holds while the key is down, and releases from where it is', () => {
    const voices = new VoicePool(8, SAMPLE_RATE, LOCK_SAMPLES);
    voices.setPatch(organ);
    voices.noteOn(60, 261.63);
    render(voices, SAMPLE_RATE * 3);
    // Two of six carriers, at 0 and -6 dB: up to (1 + 0.5) / 6.
    expect(Math.max(...render(voices, 2400).map(Math.abs))).toBeGreaterThan(0.2);
    voices.noteOff(60);
    // Held at 0 dB: 96 dB to fall at 96 dB in 0.3 s.
    render(voices, Math.round(SAMPLE_RATE * 0.31));
    expect(voices.active).toBe(0);
  });

  it('lets an operator that is off make no sound', () => {
    const silent: Dx7Patch = { ...organ, operators: organ.operators.map(o => ({ ...o, level: null })) };
    const voices = new VoicePool(8, SAMPLE_RATE, LOCK_SAMPLES);
    voices.setPatch(silent);
    voices.noteOn(60, 261.63);
    expect(render(voices, 2400).every(sample => sample === 0)).toBe(true);
  });
});
