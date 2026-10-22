import { CHAPTERS } from '../../chapters';
import { type Dx7Envelope, type Dx7Operator } from '../../dsp/dx7';
import { CONTROL_SAMPLES, type Dx7Patch, VoicePool } from '../../dsp/voicePool';
import { DEFAULTS, type LabState } from '../../model/lab';

// The envelopes worked out every CONTROL_SAMPLES samples, in straight
// lines between, sound as every sample did: the difference is far under
// the note.

const SAMPLE_RATE = 48000;
const sandbox = CHAPTERS.find(c => c.id === 'sandbox')!;
const stateOf = (label: string): LabState =>
  ({ ...DEFAULTS, ...sandbox.patch, ...sandbox.presets.find(p => p.label === label)!.patch }) as LabState;
const patchOf = (s: LabState): Dx7Patch => ({
  kind: 'dx7',
  algorithm: s.algorithm,
  feedback: s.dxFeedback,
  operators: s.dxOperators,
  lfo: s.dxLfo,
  pitchEnvelope: s.dxPitchEnvelope,
});

/** A note of `patch` at 220 Hz, held `held` s and let go (or not), `seconds` s in all. */
function play(patch: Dx7Patch, control: number, seconds: number, held = Infinity): Float32Array {
  const pool = new VoicePool(1, SAMPLE_RATE, 0.05 * SAMPLE_RATE, control);
  pool.setPatch(patch);
  pool.noteOn(57, 220);
  const out = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  for (let at = 0; at < out.length; at += 128) {
    if (at / SAMPLE_RATE >= held && at / SAMPLE_RATE < held + 128 / SAMPLE_RATE) pool.noteOff(57);
    pool.render(out.subarray(at, Math.min(out.length, at + 128)));
  }
  return out;
}

const rms = (xs: ArrayLike<number>) => Math.sqrt(Array.from(xs).reduce((sum, x) => sum + x * x, 0) / xs.length);

/** The difference between the control rate's note and every sample's, in dB under the note. */
function differenceDb(patch: Dx7Patch, seconds: number, held?: number): number {
  const exact = play(patch, 1, seconds, held);
  const control = play(patch, CONTROL_SAMPLES, seconds, held);
  return 20 * Math.log10(rms(control.map((x, i) => x - exact[i])) / rms(exact));
}

describe('envelopes at a control rate', () => {
  for (const label of ['A11 E.PIANO 1', 'A1 BRASS 1', 'A12 GUITAR 1', 'A26 TUB BELLS', 'B1 TINE PIANO']) {
    it(`${label}: held and let go, within -80 dB of every sample`, () => {
      const patch = patchOf(stateOf(label));
      expect(differenceDb(patch, 1)).toBeLessThan(-80);
      expect(differenceDb(patch, 1.5, 0.5)).toBeLessThan(-80);
    });
  }

  it('a fast attack and a fast release, within -80 dB', () => {
    const fast: Dx7Envelope = { attack: 0.001, peak: 0, decay1: 0.05, brk: -12, decay2: 0.3, sustain: -20, release: 0.01 };
    const state = stateOf('A11 E.PIANO 1');
    const operators = state.dxOperators.map((op): Dx7Operator => ({ ...op, envelope: fast }));
    expect(differenceDb(patchOf({ ...state, dxOperators: operators }), 0.6, 0.3)).toBeLessThan(-80);
  });
});
