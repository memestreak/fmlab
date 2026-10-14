// The section is in the URL's hash as an address, "#/index", so it can be
// linked to and survives a reload. "#/" (or no hash) is the landing view,
// "#/glossary" the glossary and "#/glossary?t=index" one of its entries.
// The sandbox also keeps its sound there, "#/sandbox?c=220&r=1.41&i=5", or
// with six operators
// "#/sandbox?m=6&c=220&a=5&f=0.7&o=1_90_2.5-1_35_1.2-1_70_1.5-14_25_0.4-1_40_2-1_15_1",
// so a sound can be shared by its link. Addresses from before the sections
// had names ("#3", "#7?c=…", "#glossary") are upgraded by `upgradeHash`.

import { DX7_COUNT } from '../dsp/algorithms';
import type { Operator } from '../dsp/operators';
import {
  CARRIER_HZ,
  clamp,
  FEEDBACK,
  hzToSemitones,
  INDEX,
  type LabState,
  OP_DECAY,
  OP_LEVEL,
  OP_RATIO,
  RATIO,
  semitonesToHz,
} from '../model/lab';
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

/** How many operators a link's "m" says; any other value means two. */
const SIX = '6';

/**
 * The six operators in a link, short: each as ratio_level_decay, its
 * level in whole percent, and the six joined by "-". Characters a URL
 * keeps as they are, so the link stays readable.
 */
export function operatorsParam(operators: readonly Operator[]): string {
  return operators
    .map(op => [brief(op.ratio, 3), Math.round(op.level * 100), brief(op.decay, 2)].join('_'))
    .join('-');
}

/**
 * The six operators a link's "o" describes, each value held inside its
 * range; null unless it is exactly six operators of three numbers each,
 * so a damaged link keeps the operators the chapter starts with.
 */
export function operatorsFromParam(raw: string | null): Operator[] | null {
  if (raw === null) return null;
  const rows = raw.split('-');
  if (rows.length !== 6) return null;
  const operators: Operator[] = [];
  for (const row of rows) {
    const values = row.split('_');
    if (values.length !== 3 || values.some(v => v.trim() === '')) return null;
    const [ratio, level, decay] = values.map(Number);
    if (![ratio, level, decay].every(Number.isFinite)) return null;
    operators.push({
      ratio: clamp(ratio, OP_RATIO),
      level: clamp(level / 100, OP_LEVEL),
      decay: clamp(decay, OP_DECAY),
    });
  }
  return operators;
}

/**
 * The parameters that carry a sandbox sound. With two operators: the
 * carrier in Hz, the ratio and the index. With six: "m=6", the base pitch,
 * the algorithm, the feedback and the operators. Volume stays the
 * listener's own, and is left out.
 */
export function soundParams(state: LabState): string {
  if (state.mode === 'ops') {
    return new URLSearchParams({
      m: SIX,
      c: brief(state.carrierHz, 2),
      a: String(state.algorithm),
      f: brief(state.feedback, 2),
      o: operatorsParam(state.operators),
    }).toString();
  }
  const params = new URLSearchParams({
    c: brief(state.carrierHz, 2),
    r: brief(state.ratio, 3),
    i: brief(state.index, 2),
  });
  return params.toString();
}

/**
 * The sound a link's parameters describe, as a patch: each one that is
 * there and a number, held inside its slider's range. The carrier is put
 * on the Carrier slider's nearest step, a quarter of a semitone, so a
 * hand-typed 221 Hz becomes a pitch the slider can show. Anything missing
 * or not a number is left out, to keep what the chapter starts with.
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
  if (params.get('m') === SIX) {
    // Six operators, playing notes as chapter 8 does.
    patch.mode = 'ops';
    patch.noteMode = true;
    const algorithm = read('a');
    if (algorithm !== null) {
      patch.algorithm = clamp(Math.round(algorithm), { min: 1, max: DX7_COUNT });
    }
    const feedback = read('f');
    if (feedback !== null) patch.feedback = clamp(feedback, FEEDBACK);
    const operators = operatorsFromParam(params.get('o'));
    if (operators) patch.operators = operators;
    return patch;
  }
  const ratio = read('r');
  if (ratio !== null) patch.ratio = clamp(ratio, RATIO);
  const index = read('i');
  if (index !== null) patch.index = clamp(index, INDEX);
  return patch;
}
