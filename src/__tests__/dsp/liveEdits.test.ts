import { CHAPTERS } from '../../chapters';
import {
  anchorAt,
  ampToDb,
  type Dx7Envelope,
  dx7EnvelopeAt,
  dx7EnvelopeFrom,
  type Dx7Operator,
  dx7PitchAt,
  dx7PitchFrom,
  type Dx7PitchEnvelope,
  keyAnchor,
  keyPitchAnchor,
  LIVE_GLIDE_SECONDS,
  pitchAnchorAt,
} from '../../dsp/dx7';
import { type Dx7Patch, VoicePool } from '../../dsp/voicePool';
import { anchorsAfterEdit, DEFAULTS, dx7KernelLevelsAt, type LabState } from '../../model/lab';

// Edits reaching notes already sounding (Jeremy, 2026-10-22): envelopes
// carry on from where they are, the rest glides, the algorithm waits for
// the next note.

const ENV: Dx7Envelope = { attack: 0.1, peak: 0, decay1: 1, brk: -20, decay2: 2, sustain: -30, release: 1 };
const PITCH: Dx7PitchEnvelope = {
  start: -300,
  attack: 600,
  peak: 200,
  decay1: 400,
  brk: -100,
  decay2: 100,
  sustain: 50,
  release: 300,
};
const db = (amp: number) => ampToDb(amp);

describe('an envelope carried on from an anchor', () => {
  it('from the anchor at the key, is the curve as struck exactly', () => {
    for (const hold of [Infinity, 0.05, 0.6, 2.5, 5]) {
      for (let t = 0; t < 8; t += 0.013) {
        expect(dx7EnvelopeFrom(ENV, keyAnchor(), t, hold)).toBe(dx7EnvelopeAt(ENV, t, hold));
        expect(dx7PitchFrom(PITCH, keyPitchAnchor(), t, hold)).toBe(dx7PitchAt(PITCH, t, hold));
      }
    }
  });

  it('starts where the curve as it was had got to, in every part, held or let go', () => {
    const edited: Dx7Envelope = { attack: 0.3, peak: -6, decay1: 0.4, brk: -12, decay2: 5, sustain: -18, release: 3 };
    const editedPitch: Dx7PitchEnvelope = { ...PITCH, peak: -400, brk: 300, sustain: -200, attack: 150, release: 900 };
    // Attack, decay 1, decay 2, sustain; then released at 4 s, edited at 4.5.
    for (const [time, hold] of [
      [0.05, Infinity],
      [0.6, Infinity],
      [2, Infinity],
      [5, Infinity],
      [4.5, 4],
    ]) {
      const anchor = anchorAt(ENV, keyAnchor(), time, hold);
      expect(db(dx7EnvelopeFrom(edited, anchor, time, hold))).toBeCloseTo(db(dx7EnvelopeAt(ENV, time, hold)), 6);
      const pitch = pitchAnchorAt(PITCH, keyPitchAnchor(), time, hold);
      expect(dx7PitchFrom(editedPitch, pitch, time, hold)).toBeCloseTo(dx7PitchAt(PITCH, time, hold), 6);
    }
    expect(anchorAt(ENV, keyAnchor(), 0.05).part).toBe('attack');
    expect(anchorAt(ENV, keyAnchor(), 0.6).part).toBe('decay1');
    expect(anchorAt(ENV, keyAnchor(), 2).part).toBe('decay2');
    expect(anchorAt(ENV, keyAnchor(), 5).part).toBe('sustain');
    expect(anchorAt(ENV, keyAnchor(), 4.5, 4).part).toBe('release');
  });

  it('heads for the edited part\'s level at its speed, then runs the later parts as set', () => {
    // Half way down the first decay, at -10 dB: the break moved to -30
    // and the decay made 0.5 s, 60 dB a second from the peak.
    const anchor = anchorAt(ENV, keyAnchor(), 0.6);
    expect(anchor).toEqual({ at: 0.6, db: expect.closeTo(-10, 9), part: 'decay1' });
    const edited = { ...ENV, decay1: 0.5, brk: -30, sustain: -40 };
    expect(db(dx7EnvelopeFrom(edited, anchor, 0.7))).toBeCloseTo(-16, 6);
    // At the break 20 / 60 s later; then the second decay, -30 to -40 in 2 s.
    const atBreak = 0.6 + 20 / 60;
    expect(db(dx7EnvelopeFrom(edited, anchor, atBreak + 0.5))).toBeCloseTo(-32.5, 6);
    expect(db(dx7EnvelopeFrom(edited, anchor, atBreak + 2.5))).toBeCloseTo(-40, 6);
  });

  it('holds in the sustain when the first decay is shortened, and glides to a new sustain at the second decay\'s speed', () => {
    const anchor = anchorAt(ENV, keyAnchor(), 5);
    expect(anchor.part).toBe('sustain');
    const shorter = { ...ENV, decay1: 0.2 };
    for (const t of [5, 5.5, 6, 10]) expect(db(dx7EnvelopeFrom(shorter, anchor, t))).toBeCloseTo(-30, 6);
    // Sustain up to -25: the second decay goes from -20 to -25 in 2 s,
    // 2.5 dB a second, so -30 to -25 takes 2 s.
    const louder = { ...ENV, sustain: -25 };
    expect(db(dx7EnvelopeFrom(louder, anchor, 6))).toBeCloseTo(-27.5, 6);
    expect(db(dx7EnvelopeFrom(louder, anchor, 8))).toBeCloseTo(-25, 6);
  });

  it('is over at once in a part already passed, and never steps the level', () => {
    // In the first decay at -10 dB, the break raised to -5: passed going
    // down, so on into the second decay from -10, towards -30.
    const anchor = anchorAt(ENV, keyAnchor(), 0.6);
    const raised = { ...ENV, brk: -5, decay1: 0 };
    let last = dx7EnvelopeFrom(raised, anchor, 0.6);
    for (let t = 0.6; t < 0.6 + LIVE_GLIDE_SECONDS * 2; t += 1 / 48000) {
      const now = dx7EnvelopeFrom(raised, anchor, t);
      expect(Math.abs(db(now) - db(last))).toBeLessThan(0.05);
      last = now;
    }
  });

  it('lets go from where an edited curve has got to', () => {
    const anchor = anchorAt(ENV, keyAnchor(), 0.6);
    const edited = { ...ENV, decay1: 0.5, brk: -30, release: 0.5 };
    const atHold = db(dx7EnvelopeFrom(edited, anchor, 0.7));
    // Let go at 0.7: 96 dB in half a second, 192 a second.
    expect(db(dx7EnvelopeFrom(edited, anchor, 0.75, 0.7))).toBeCloseTo(atHold - 9.6, 6);
  });

  it('anchors a second edit from the first', () => {
    const first = anchorAt(ENV, keyAnchor(), 0.6);
    const edited = { ...ENV, decay1: 0.5, brk: -30 };
    const second = anchorAt(edited, first, 0.7);
    expect(second.db).toBeCloseTo(-16, 6);
    expect(second.part).toBe('decay1');
  });
});

describe('the pool, edited while a note sounds', () => {
  const SAMPLE_RATE = 48000;
  const sandbox = CHAPTERS.find(c => c.id === 'sandbox')!;
  const state: LabState = { ...DEFAULTS, ...sandbox.patch } as LabState;
  const patchOf = (s: LabState): Dx7Patch => ({
    kind: 'dx7',
    algorithm: s.algorithm,
    feedback: s.dxFeedback,
    operators: s.dxOperators,
    lfo: s.dxLfo,
    pitchEnvelope: s.dxPitchEnvelope,
  });
  const withOps = (s: LabState, edit: (op: Dx7Operator, i: number) => Dx7Operator): LabState => ({
    ...s,
    dxOperators: s.dxOperators.map(edit),
  });
  const pool = () => {
    const voices = new VoicePool(4, SAMPLE_RATE, 0.05 * SAMPLE_RATE);
    voices.setPatch(patchOf(state));
    return voices;
  };
  const render = (voices: VoicePool, samples: number) => {
    const out = new Float32Array(samples);
    for (let at = 0; at < samples; at += 128) voices.render(out.subarray(at, Math.min(samples, at + 128)));
    return out;
  };
  const steepest = (out: Float32Array) => {
    let most = 0;
    for (let i = 1; i < out.length; i++) most = Math.max(most, Math.abs(out[i] - out[i - 1]));
    return most;
  };
  const HZ = 261.63;
  // Every operator 12 dB down, and each ratio's coarse step one up.
  const quieter = withOps(state, op => ({ ...op, level: op.level === null ? null : op.level - 12 }));
  const higher = withOps(state, op => ({ ...op, ratio: op.ratio + 1 }));

  it('reaches a held note, with no step bigger than the note makes itself', () => {
    for (const edited of [quieter, higher]) {
      const plain = pool();
      plain.noteOn(60, HZ);
      render(plain, 4800);
      const unedited = render(plain, 4800);

      const voices = pool();
      voices.noteOn(60, HZ);
      render(voices, 4800);
      voices.setPatch(patchOf(edited), true);
      // The glide, and the note once it is over.
      const glide = render(voices, 2 * LIVE_GLIDE_SECONDS * SAMPLE_RATE);
      const settled = render(voices, 4800);
      expect(steepest(settled)).toBeGreaterThan(0);
      // Changed: not the note it would have been.
      const after = Float32Array.from([...glide, ...settled]);
      expect(after.some((x, i) => Math.abs(x - unedited[i]) > 1e-3)).toBe(true);
      // No click: no jump beyond what the note makes before or after.
      expect(steepest(glide)).toBeLessThan(1.5 * Math.max(steepest(unedited), steepest(settled)));
    }
  });

  it('a patch that is not live leaves a held note alone', () => {
    const plain = pool();
    plain.noteOn(60, HZ);
    render(plain, 4800);
    const voices = pool();
    voices.noteOn(60, HZ);
    render(voices, 4800);
    voices.setPatch(patchOf(quieter));
    expect(Array.from(render(voices, 2400))).toEqual(Array.from(render(plain, 2400)));
  });

  it('never rewires a held note: a new algorithm waits for the next', () => {
    const plain = pool();
    plain.noteOn(60, HZ);
    render(plain, 4800);
    const voices = pool();
    voices.noteOn(60, HZ);
    render(voices, 4800);
    voices.setPatch(patchOf({ ...state, algorithm: 32 }), true);
    // The same note: an edit starts a new control run of the envelopes
    // (CONTROL_SAMPLES), so not to the last bit, but far under hearing.
    const heard = render(voices, 2400);
    const unedited = render(plain, 2400);
    const rms = (xs: ArrayLike<number>) => Math.sqrt(Array.from(xs).reduce((sum, x) => sum + x * x, 0) / xs.length);
    const difference = rms(heard.map((x, i) => x - unedited[i]));
    expect(20 * Math.log10(difference / rms(unedited))).toBeLessThan(-80);
  });

  it('strikes the next note with the edited patch whole', () => {
    const voices = pool();
    voices.noteOn(60, HZ);
    render(voices, 2400);
    voices.setPatch(patchOf(quieter), true);
    voices.noteOn(64, 329.63);
    render(voices, 2400);
    const fresh = new VoicePool(4, SAMPLE_RATE, 0.05 * SAMPLE_RATE);
    fresh.setPatch(patchOf(quieter));
    fresh.noteOn(64, 329.63);
    render(fresh, 2400);
    expect(voices.kernelLevelsOf(64)).toEqual(fresh.kernelLevelsOf(64));
  });

  it('is drawn as heard: the figures\' levels agree with the pool\'s after an edit', () => {
    const voices = pool();
    voices.noteOn(60, HZ);
    const struck: LabState = { ...state, carrierHz: HZ, noteStartedAt: 0, noteLength: Infinity, noteHold: Infinity };
    // Edited 0.3 s in: every envelope's first decay twice as fast, its break lower.
    render(voices, 0.3 * SAMPLE_RATE);
    const faster = withOps(struck, op => ({ ...op, envelope: { ...op.envelope, decay1: op.envelope.decay1 / 2, brk: op.envelope.brk - 6 } }));
    voices.setPatch(patchOf(faster), true);
    const drawn: LabState = { ...faster, noteAnchors: anchorsAfterEdit(struck, 0.3) ?? null };
    let rendered = 0.3 * SAMPLE_RATE;
    for (const seconds of [0.35, 0.6, 1.2]) {
      render(voices, seconds * SAMPLE_RATE - rendered);
      rendered = seconds * SAMPLE_RATE;
      const heard = voices.kernelLevelsOf(60)!;
      const figures = dx7KernelLevelsAt(drawn, seconds);
      heard.forEach((level, op) => expect(figures[op]).toBeCloseTo(level, 4));
    }
  });
});
