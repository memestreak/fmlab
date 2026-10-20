import { algorithm } from '../../dsp/algorithms';
import {
  type Dx7Lfo,
  dx7EnvelopeAt,
  dx7Note,
  type Dx7PitchEnvelope,
  FLAT_PITCH_ENVELOPE,
  HELD_LFO,
  heldOperator,
} from '../../dsp/dx7';
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
    lfo: HELD_LFO,
    pitchEnvelope: FLAT_PITCH_ENVELOPE,
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

describe('the voice pool\'s LFO', () => {
  // OP1 alone, a sine, at full level: a sixth of full scale (algorithm 32).
  const sine = (lfo: Partial<Dx7Lfo>, tremolo = 0): Dx7Patch => ({
    kind: 'dx7',
    algorithm: 32,
    feedback: 0,
    operators: [
      { ...heldOperator(1, 0), tremolo },
      ...[2, 3, 4, 5, 6].map(r => heldOperator(r, null)),
    ],
    // A square, synced, very slow: from a key on it sits at its bottom,
    // which swings the pitch down and pulls levels hardest, for seconds.
    lfo: { ...HELD_LFO, wave: 'square', speed: 0.065, sync: true, ...lfo },
    pitchEnvelope: FLAT_PITCH_ENVELOPE,
  });
  const peak = (samples: Float32Array) => Math.max(...samples.map(Math.abs));
  /** Rising zero crossings a second. */
  const pitchOf = (samples: Float32Array) => {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
    return (crossings * SAMPLE_RATE) / samples.length;
  };

  it('swings every note\'s pitch by the vibrato, in cents', () => {
    const voices = new VoicePool(1, SAMPLE_RATE, LOCK_SAMPLES);
    voices.setPatch(sine({ vibrato: 1200 }));
    voices.noteOn(69, 440);
    render(voices, SAMPLE_RATE * 0.1);
    // An octave down at the wave's bottom.
    expect(pitchOf(render(voices, SAMPLE_RATE))).toBeCloseTo(220, -1);
  });

  it('pulls an operator down by its share of the tremolo, in dB', () => {
    const level = (tremolo: number, share: number) => {
      const voices = new VoicePool(1, SAMPLE_RATE, LOCK_SAMPLES);
      voices.setPatch(sine({ tremolo }, share));
      voices.noteOn(69, 440);
      render(voices, SAMPLE_RATE * 0.1);
      return peak(render(voices, 4800));
    };
    expect(level(0, 1)).toBeCloseTo(1 / 6, 2);
    // 20 dB: a tenth.
    expect(level(20, 1) / level(0, 1)).toBeCloseTo(0.1, 2);
    // A quarter of 20 dB on an operator taking a quarter.
    expect(level(20, 0.25) / level(0, 1)).toBeCloseTo(10 ** (-5 / 20), 2);
    // An operator taking none is untouched.
    expect(level(20, 0)).toBeCloseTo(level(0, 1), 6);
  });

  it('holds the LFO back for its delay after every key, for the notes held too', () => {
    const voices = new VoicePool(2, SAMPLE_RATE, LOCK_SAMPLES);
    voices.setPatch(sine({ tremolo: 20, delay: 0.5 }, 1));
    voices.noteOn(60, 261.63);
    // Through the delay, untouched; once faded in, a tenth.
    expect(peak(render(voices, SAMPLE_RATE * 0.4))).toBeCloseTo(1 / 6, 2);
    render(voices, SAMPLE_RATE * 0.7);
    expect(peak(render(voices, 4800))).toBeCloseTo(1 / 60, 2);
    // A second key: the held note is let go of the LFO again too.
    voices.noteOn(72, 523.25);
    render(voices, SAMPLE_RATE * 0.05);
    expect(peak(render(voices, SAMPLE_RATE * 0.3))).toBeGreaterThan(0.25);
  });
});

describe('the voice pool\'s pitch envelope', () => {
  const sine = (pitchEnvelope: Dx7PitchEnvelope, lfo: Partial<Dx7Lfo> = {}): Dx7Patch => ({
    kind: 'dx7',
    algorithm: 32,
    feedback: 0,
    operators: [heldOperator(1, 0), ...[2, 3, 4, 5, 6].map(r => heldOperator(r, null))],
    lfo: { ...HELD_LFO, ...lfo },
    pitchEnvelope,
  });
  /** Rising zero crossings a second. */
  const pitchOf = (samples: Float32Array) => {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
    return (crossings * SAMPLE_RATE) / samples.length;
  };
  // An octave up at the key, gliding down to the note at 12 semitones a
  // second, held there; let go, back up at the same speed.
  const fall: Dx7PitchEnvelope = {
    ...FLAT_PITCH_ENVELOPE,
    start: 1200,
    attack: 1200,
    peak: 0,
    release: 1200,
  };

  it('bends a struck note as its envelope says, and back on release', () => {
    const voices = new VoicePool(1, SAMPLE_RATE, LOCK_SAMPLES);
    voices.setPatch(sine(fall));
    voices.noteOn(69, 220);
    // The first tenth of a second, near an octave up.
    expect(pitchOf(render(voices, SAMPLE_RATE * 0.1))).toBeGreaterThan(400);
    render(voices, SAMPLE_RATE);
    // Down at the note.
    expect(pitchOf(render(voices, SAMPLE_RATE * 0.5))).toBeCloseTo(220, -1);
    voices.noteOff(69);
    // Let go, it glides back up at 12 semitones a second: over the first
    // quarter second (its operators' 0.3 s release) well above the note.
    expect(pitchOf(render(voices, SAMPLE_RATE * 0.25))).toBeGreaterThan(230);
  });

  it('gives each note its own, from its own key', () => {
    const play = (second: boolean) => {
      const voices = new VoicePool(2, SAMPLE_RATE, LOCK_SAMPLES);
      voices.setPatch(sine(fall));
      voices.noteOn(60, 220);
      render(voices, SAMPLE_RATE * 1.5);
      if (second) voices.noteOn(62, 330);
      return render(voices, SAMPLE_RATE * 0.1);
    };
    // The second note alone: the two together less the first.
    const both = play(true);
    const first = play(false);
    const second = both.map((sample, i) => sample - first[i]);
    // It starts an octave up, 660 Hz, as the first did; the first, held,
    // stays at its note.
    expect(pitchOf(second)).toBeGreaterThan(560);
    expect(pitchOf(first)).toBeCloseTo(220, -1);
  });

  it('adds the LFO\'s vibrato to it', () => {
    const voices = new VoicePool(1, SAMPLE_RATE, LOCK_SAMPLES);
    // Held a fifth up, with an octave's vibrato pulling down (a square, synced).
    const fifth = { ...FLAT_PITCH_ENVELOPE, start: 700, peak: 700, brk: 700, sustain: 700 };
    voices.setPatch(sine(fifth, { wave: 'square', speed: 0.065, sync: true, vibrato: 1200 }));
    voices.noteOn(69, 440);
    render(voices, SAMPLE_RATE * 0.1);
    // 440 × 2^((700 - 1200) / 1200): about 329.6 Hz.
    expect(pitchOf(render(voices, SAMPLE_RATE))).toBeCloseTo(440 * 2 ** (-500 / 1200), -1);
  });
});
