// How much of the audio thread's time the voice pool takes: VoicePool.render
// for 0, 1, 4 and 8 held notes of A11 E.PIANO 1 and of the costliest
// preset, at 48 kHz in 128-sample blocks, as the worklet renders. Not run
// in CI; `npm run bench:voices`. Each block's time is a share of its
// budget, 128 / 48000 s; the average and the worst 1% (99th percentile).

import { CHAPTERS } from '../src/chapters';
import type { Preset } from '../src/chapters/types';
import { type Dx7Patch, VoicePool, VOICES } from '../src/dsp/voicePool';
import { DEFAULTS, type LabState } from '../src/model/lab';

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const BUDGET_MS = (BLOCK / SAMPLE_RATE) * 1000;
const WARM_SECONDS = 1;
const MEASURE_SECONDS = 4;
/** The keys held, C3 up in a C major spread. */
const KEYS = [48, 52, 55, 60, 64, 67, 72, 76];

const sandbox = CHAPTERS.find(chapter => chapter.id === 'sandbox')!;

function patchOf(preset: Preset): Dx7Patch {
  const state = { ...DEFAULTS, ...sandbox.patch, ...preset.patch } as LabState;
  return {
    kind: 'dx7',
    algorithm: state.algorithm,
    feedback: state.dxFeedback,
    operators: state.dxOperators,
    lfo: state.dxLfo,
    pitchEnvelope: state.dxPitchEnvelope,
  };
}

const hz = (key: number) => 440 * 2 ** ((key - 69) / 12);

/** Each block's render time as a share of its budget, `notes` keys held. */
function run(patch: Dx7Patch, notes: number, seconds = MEASURE_SECONDS): number[] {
  const pool = new VoicePool(VOICES, SAMPLE_RATE, 0.05 * SAMPLE_RATE);
  pool.setPatch(patch);
  for (const key of KEYS.slice(0, notes)) pool.noteOn(key, hz(key));
  const out = new Float32Array(BLOCK);
  for (let i = 0; i < (WARM_SECONDS * SAMPLE_RATE) / BLOCK; i++) pool.render(out);
  const shares: number[] = [];
  for (let i = 0; i < (seconds * SAMPLE_RATE) / BLOCK; i++) {
    const start = performance.now();
    pool.render(out);
    shares.push((performance.now() - start) / BUDGET_MS);
  }
  return shares;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
function summary(shares: number[]): { mean: number; p99: number } {
  const sorted = [...shares].sort((a, b) => a - b);
  return { mean: shares.reduce((a, b) => a + b, 0) / shares.length, p99: sorted[Math.floor(sorted.length * 0.99)] };
}

it('benchmarks the voice pool', () => {
  const presets = sandbox.presets;
  // The costliest preset: eight notes of each, briefly.
  const costs = presets.map(preset => summary(run(patchOf(preset), 8, 0.5)).mean);
  const worst = presets[costs.indexOf(Math.max(...costs))];
  // E.PIANO 1, the costliest here, and the costliest before and after
  // the control-rate envelopes (A5 STRINGS 2, B2 SUITCASE), to compare.
  const named = ['A11 E.PIANO 1', 'A5 STRINGS 2', 'B2 SUITCASE'].map(label => presets.find(p => p.label === label)!);
  const shown = named.includes(worst) ? named : [...named, worst];
  const lines = [
    `Block budget ${BUDGET_MS.toFixed(3)} ms (${BLOCK} samples at ${SAMPLE_RATE} Hz); costliest here: ${worst.label}`,
  ];
  for (const preset of shown) {
    for (const notes of [0, 1, 4, 8]) {
      const { mean, p99 } = summary(run(patchOf(preset), notes));
      lines.push(`${preset.label.padEnd(16)} ${String(notes).padStart(2)} notes  mean ${pct(mean).padStart(6)}  p99 ${pct(p99).padStart(6)}`);
    }
  }
  console.log(lines.join('\n'));
}, 600_000);
