// The section is in the URL's hash as an address, "#/index", so it can be
// linked to and survives a reload. "#/" (or no hash) is the landing view,
// "#/glossary" the glossary and "#/glossary?t=index" one of its entries.
// The sandbox also keeps its sound there,
// "#/sandbox?c=220&a=5&f=3.142&o=1_0_-0.9_0.002_0_1.2_-12_4_-48_0.4_60_l0_l0_1.3~…",
// so a sound can be shared by its link. Addresses from before the sections
// had names ("#3", "#7?c=…", "#glossary") are upgraded by `upgradeHash`.

import { DX7_COUNT } from '../dsp/algorithms';
import {
  DETUNE_CENTS,
  DX7_FEEDBACK,
  DX7_RATIO,
  type Dx7Lfo,
  type Dx7Operator,
  type Dx7PitchEnvelope,
  LEVEL_DB,
  LFO_DELAY,
  LFO_SPEED,
  LFO_TREMOLO,
  LFO_VIBRATO,
  LFO_WAVES,
  type LfoWave,
  MAX_STAGE_SECONDS,
  PITCH_EG_SPEED,
  PITCH_ENVELOPE_CENTS,
  RATE_SCALING,
  SCALING_DEPTH,
  type ScalingSide,
  SILENCE_DB,
} from '../dsp/dx7';
import { AMS_SHARES } from '../dsp/lfo';
import { CARRIER_HZ, clamp, hzToSemitones, type LabState, semitonesToHz } from '../model/lab';
import { GLOSSARY, LANDING, type SectionId } from './outline';

/** The hash's parts: the address after "#/", and anything after a "?". */
const HASH = /^#\/([a-z0-9-]*)(?:\?(.*))?$/;

/**
 * What a hash shows: a section in `ids`, the glossary, or the landing
 * view for "#/"; `fallback` when it names none of them.
 *
 * @param ids the sections that exist
 */
export function viewFromHash(
  hash: string,
  ids: readonly string[],
  fallback: string,
): string {
  const match = HASH.exec(hash);
  if (!match) return fallback;
  const [, address] = match;
  if (address === '') return LANDING;
  if (address === GLOSSARY) return GLOSSARY;
  return ids.includes(address) ? address : fallback;
}

/** What follows the "?" in a hash, as parameters; empty if nothing does. */
export function paramsFromHash(hash: string): URLSearchParams {
  return new URLSearchParams(HASH.exec(hash)?.[2] ?? '');
}

/** The hash for a section, the landing view or the glossary. */
export function hashFor(id: string, params?: string): string {
  const address = id === LANDING ? '#/' : `#/${id}`;
  return params ? `${address}?${params}` : address;
}

/**
 * Whether a hash is one the page should take out of the address bar: it
 * is there, but names nothing, so the page is showing the landing view
 * under an address that claims otherwise.
 */
export function isStrayHash(hash: string, ids: readonly string[]): boolean {
  if (hash === '' || hash === '#') return false;
  return viewFromHash(hash, ids, '') === '';
}

/** The sections' numbers before they had names, for old links. */
const OLD_NUMBERS: Record<string, SectionId | typeof LANDING> = {
  0: LANDING,
  1: 'sine',
  2: 'vibrato',
  3: 'index',
  4: 'sidebands',
  5: 'ratio',
  6: 'envelopes',
  7: 'sandbox',
  8: 'algorithms',
  9: 'fm-vs-pm',
};
const OLD_HASH = /^#(\d+|glossary)(?:\?(.*))?$/;

/**
 * The address an old link meant ("#4" is now "#/sidebands", "#7?c=220…"
 * "#/sandbox?c=220…", "#glossary?t=index" "#/glossary?t=index"), with its
 * parameters kept; null for anything else, including a number that never
 * had a section.
 */
export function upgradeHash(hash: string): string | null {
  const match = OLD_HASH.exec(hash);
  if (!match) return null;
  const [, old, query] = match;
  const id = old === GLOSSARY ? GLOSSARY : OLD_NUMBERS[old];
  return id === undefined ? null : hashFor(id, query);
}

/** A number written as briefly as it can be to `places` decimals: 1.41, 220, 2.5. */
function brief(value: number, places: number): string {
  return String(Number(value.toFixed(places)));
}

/**
 * The six operators of a DX7 voice in a link, short: each as its ratio,
 * detune, level ("x" for off), its envelope (attack, peak, decay 1, break,
 * decay 2, sustain, release), its break point, left and right scaling
 * (curve "l" or "e" then depth), rate scaling and its share of the
 * LFO's tremolo as a percentage, joined by "_", and the six joined by
 * "~". Characters a URL keeps as they are.
 */
export function operatorsParam(operators: readonly Dx7Operator[]): string {
  const side = ({ curve, depth }: ScalingSide) => `${curve === 'lin' ? 'l' : 'e'}${brief(depth, 3)}`;
  return operators
    .map(op => {
      const e = op.envelope;
      return [
        brief(op.ratio, 4),
        brief(op.detune, 2),
        op.level === null ? 'x' : brief(op.level, 2),
        brief(e.attack, 4),
        brief(e.peak, 2),
        brief(e.decay1, 4),
        brief(e.brk, 2),
        brief(e.decay2, 4),
        brief(e.sustain, 2),
        brief(e.release, 4),
        String(Math.round(op.breakKey)),
        side(op.left),
        side(op.right),
        brief(op.rateScaling, 4),
        brief(op.tremolo * 100, 1),
      ].join('_');
    })
    .join('~');
}

const FIELDS = 15;
const STAGE = { min: 0, max: MAX_STAGE_SECONDS };
const ENV_LEVEL = { min: SILENCE_DB, max: 0 };
/** The DX7's break points: A-1 to C8 (MIDI 21 to 120). */
const KEYS = { min: 21, max: 120 };

/**
 * The six operators a link's "o" describes, each value held inside its
 * range; null unless it is exactly six operators of fifteen fields each,
 * all readable, so a damaged or old link keeps the voice the sandbox
 * starts with.
 */
export function operatorsFromParam(raw: string | null): Dx7Operator[] | null {
  if (raw === null) return null;
  const rows = raw.split('~');
  if (rows.length !== 6) return null;
  const number = (text: string) => (text.trim() === '' ? NaN : Number(text));
  const side = (text: string): ScalingSide | null => {
    const curve = text[0] === 'l' ? 'lin' : text[0] === 'e' ? 'exp' : null;
    const depth = number(text.slice(1));
    if (!curve || !Number.isFinite(depth)) return null;
    return { curve, depth: clamp(depth, SCALING_DEPTH) };
  };
  const operators: Dx7Operator[] = [];
  for (const row of rows) {
    const f = row.split('_');
    if (f.length !== FIELDS) return null;
    const values = [0, 1, ...[3, 4, 5, 6, 7, 8, 9, 10, 13, 14]].map(i => number(f[i]));
    if (!values.every(Number.isFinite)) return null;
    const level = f[2] === 'x' ? null : number(f[2]);
    if (level !== null && !Number.isFinite(level)) return null;
    const left = side(f[11]);
    const right = side(f[12]);
    if (!left || !right) return null;
    const [ratio, detune, attack, peak, decay1, brk, decay2, sustain, release, breakKey, rate, share] = values;
    operators.push({
      ratio: clamp(ratio, DX7_RATIO),
      detune: clamp(detune, DETUNE_CENTS),
      level: level === null ? null : clamp(level, LEVEL_DB),
      envelope: {
        attack: clamp(attack, STAGE),
        peak: clamp(peak, ENV_LEVEL),
        decay1: clamp(decay1, STAGE),
        brk: clamp(brk, ENV_LEVEL),
        decay2: clamp(decay2, STAGE),
        sustain: clamp(sustain, ENV_LEVEL),
        release: clamp(release, STAGE),
      },
      breakKey: clamp(Math.round(breakKey), KEYS),
      left,
      right,
      rateScaling: clamp(rate, RATE_SCALING),
      tremolo: nearestShare(share / 100),
    });
  }
  return operators;
}

/** The DX7 tremolo share (AMS) nearest `share`. */
export function nearestShare(share: number): number {
  return AMS_SHARES.reduce((best, step) => (Math.abs(step - share) < Math.abs(best - share) ? step : best));
}

/** The LFO in a link: wave, speed, delay, vibrato, tremolo and sync, joined by "_". */
export function lfoParam(lfo: Dx7Lfo): string {
  return [
    lfo.wave,
    brief(lfo.speed, 3),
    brief(lfo.delay, 3),
    brief(lfo.vibrato, 1),
    brief(lfo.tremolo, 1),
    lfo.sync ? '1' : '0',
  ].join('_');
}

/** The LFO a link's "l" describes, each number held inside its range; null if it is not one. */
export function lfoFromParam(raw: string | null): Dx7Lfo | null {
  if (raw === null) return null;
  const f = raw.split('_');
  if (f.length !== 6 || !(LFO_WAVES as readonly string[]).includes(f[0])) return null;
  const [speed, delay, vibrato, tremolo] = f.slice(1, 5).map(text => (text.trim() === '' ? NaN : Number(text)));
  if (![speed, delay, vibrato, tremolo].every(Number.isFinite) || !['0', '1'].includes(f[5])) return null;
  return {
    wave: f[0] as LfoWave,
    speed: clamp(speed, LFO_SPEED),
    delay: clamp(delay, LFO_DELAY),
    vibrato: clamp(vibrato, LFO_VIBRATO),
    tremolo: clamp(tremolo, LFO_TREMOLO),
    sync: f[5] === '1',
  };
}

/** The pitch envelope's fields in a link, in this order. */
const PITCH_FIELDS = ['start', 'attack', 'peak', 'decay1', 'brk', 'decay2', 'sustain', 'release'] as const;
const PITCH_SPEEDS = new Set<string>(['attack', 'decay1', 'decay2', 'release']);

/**
 * The pitch envelope in a link: start, attack, peak, decay 1, break,
 * decay 2, sustain and release, joined by "_"; levels in cents, speeds in
 * cents a second.
 */
export function pitchParam(env: Dx7PitchEnvelope): string {
  return PITCH_FIELDS.map(key => brief(env[key], 2)).join('_');
}

/** The pitch envelope a link's "p" describes, each value held inside its range; null if it is not one. */
export function pitchFromParam(raw: string | null): Dx7PitchEnvelope | null {
  if (raw === null) return null;
  const f = raw.split('_').map(text => (text.trim() === '' ? NaN : Number(text)));
  if (f.length !== PITCH_FIELDS.length || !f.every(Number.isFinite)) return null;
  const env = {} as Dx7PitchEnvelope;
  PITCH_FIELDS.forEach((key, i) => {
    env[key] = clamp(f[i], PITCH_SPEEDS.has(key) ? PITCH_EG_SPEED : PITCH_ENVELOPE_CENTS);
  });
  return env;
}

/**
 * The parameters that carry a sandbox sound: the base pitch, the
 * algorithm, the feedback, the six operators, the LFO and the pitch
 * envelope. Volume stays the
 * listener's own, and is left out.
 */
export function soundParams(state: LabState): string {
  return new URLSearchParams({
    c: brief(state.carrierHz, 2),
    a: String(state.algorithm),
    f: brief(state.dxFeedback, 4),
    o: operatorsParam(state.dxOperators),
    l: lfoParam(state.dxLfo),
    p: pitchParam(state.dxPitchEnvelope),
  }).toString();
}

/**
 * The sound a link's parameters describe, as a patch: each one that is
 * there and a number, held inside its slider's range. The carrier is put
 * on the Carrier slider's nearest step, a quarter of a semitone, so a
 * hand-typed 221 Hz becomes a pitch the slider can show. Anything missing
 * or not a number is left out, to keep what the chapter starts with.
 * A link from before the DX7 voice (its "o" of three numbers an
 * operator, or the two operators' "r" and "i") keeps its pitch and
 * algorithm; the rest is passed over.
 */
export function soundFromParams(params: URLSearchParams): Partial<LabState> {
  const read = (key: string) => {
    const raw = params.get(key);
    if (raw === null || raw.trim() === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  const patch: Partial<LabState> = {};
  const carrier = read('c');
  if (carrier !== null && carrier > 0) {
    const hz = clamp(carrier, CARRIER_HZ);
    patch.carrierHz = semitonesToHz(Math.round(hzToSemitones(hz) * 4) / 4);
  }
  const algorithm = read('a');
  if (algorithm !== null) {
    patch.algorithm = clamp(Math.round(algorithm), { min: 1, max: DX7_COUNT });
  }
  const feedback = read('f');
  if (feedback !== null) patch.dxFeedback = clamp(feedback, DX7_FEEDBACK);
  const operators = operatorsFromParam(params.get('o'));
  if (operators) patch.dxOperators = operators;
  const lfo = lfoFromParam(params.get('l'));
  if (lfo) patch.dxLfo = lfo;
  const pitch = pitchFromParam(params.get('p'));
  if (pitch) patch.dxPitchEnvelope = pitch;
  return patch;
}
