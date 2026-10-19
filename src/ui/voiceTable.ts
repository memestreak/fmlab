// The sandbox's operator table: a row per operator of its DX7 voice, the
// full width of the page. Each row has the operator's tag and role, its
// ratio (slider and box), detune in cents, level in dB (slider and box),
// its share of the LFO's tremolo (a box stepping between the DX7's four),
// and two small drawings, to compare at a glance: its envelope and its
// level across the keyboard. A row clicked or focused is the selected
// one, outlined, and the operator panel above shows it; a click on a
// drawing also opens that drawing's tab there, where it is edited.

import { algorithm, operatorsUsed } from '../dsp/algorithms';
import { DETUNE_CENTS, DX7_RATIO, type Dx7Envelope, type Dx7Operator, LEVEL_DB } from '../dsp/dx7';
import type { LabState, LabStore, VoiceTab } from '../model/lab';
import { describeKeyScaling, drawKeyScaling } from '../viz/keyScalingPlot';
import { drawVoiceEnvelope } from '../viz/voiceEnvelopePlot';
import { AMS_SHARES } from '../dsp/lfo';
import { roleOf } from './operators';
import { createParam, typedNumber } from './paramControl';
import { formatCents, formatDb, noteName } from './voiceFormat';

/** The ratios the Ratio slider snaps to: a half and 1 to 31, the DX7's coarse ratios. */
export const DX7_RATIO_STOPS: readonly number[] = [0.5, ...Array.from({ length: 31 }, (_, i) => i + 1)];
const SLIDER_TOP = 31;

/** The stop nearest a ratio. */
export function snapDx7Ratio(ratio: number): number {
  return DX7_RATIO_STOPS.reduce((best, stop) =>
    Math.abs(stop - ratio) < Math.abs(best - ratio) ? stop : best,
  );
}

/** The next stop up or down from a ratio, which may be between stops. */
export function stepDx7Ratio(ratio: number, direction: 1 | -1): number {
  if (direction > 0) return DX7_RATIO_STOPS.find(stop => stop > ratio + 1e-9) ?? ratio;
  return [...DX7_RATIO_STOPS].reverse().find(stop => stop < ratio - 1e-9) ?? DX7_RATIO.min;
}

/** The Level slider's bottom, a step below -72 dB: off. */
const LEVEL_OFF = LEVEL_DB.min - 1;

/** The pen an operator's role draws in. */
export const penOf = (role: string) => (role === 'carrier' ? '--pen-blue' : '--pen-green');

/** Changes one operator of the voice. */
export function setDxOperator(store: LabStore, op: number, patch: Partial<Dx7Operator>): void {
  const dxOperators = store.get().dxOperators.map((o, i) => (i === op ? { ...o, ...patch } : o));
  store.set({ dxOperators });
}

/** Changes one operator's envelope. */
export function setDxEnvelope(store: LabStore, op: number, patch: Partial<Dx7Envelope>): void {
  const envelope = { ...store.get().dxOperators[op].envelope, ...patch };
  setDxOperator(store, op, { envelope });
}

/** A tremolo share as the box shows it: "off", "26 %", "43 %", "100 %". */
export function formatShare(share: number): string {
  return share === 0 ? 'off' : `${Math.round(share * 100)} %`;
}

/** The DX7 share (AMS step) nearest `share`, and the one a step up or down from it. */
export function nearestStep(share: number): number {
  let best = 0;
  AMS_SHARES.forEach((step, i) => {
    if (Math.abs(step - share) < Math.abs(AMS_SHARES[best] - share)) best = i;
  });
  return best;
}

/** A share typed: "off" or "0" is none, a number is a percentage, snapped to the nearest step. */
export function parseShare(text: string): number | undefined {
  if (/^\s*off\s*$/i.test(text)) return 0;
  const value = typedNumber(text.replace('%', ''));
  return value === undefined ? undefined : AMS_SHARES[nearestStep(value / 100)];
}

const within = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, value));

/** Builds the table in `#voice-table` and keeps it showing the store. */
export function mountVoiceTable(store: LabStore): void {
  const body = document.querySelector<HTMLTableSectionElement>('#voice-table tbody');
  if (!body) return;

  const point = (op: number | null) => {
    if (store.get().hoverOp !== op) store.set({ hoverOp: op });
  };
  const select = (op: number) => {
    if (store.get().selectedOp !== op) store.set({ selectedOp: op });
  };
  const open = (op: number, voiceTab: VoiceTab) => {
    const state = store.get();
    if (state.selectedOp !== op || state.voiceTab !== voiceTab) store.set({ selectedOp: op, voiceTab });
  };

  const updates: (() => void)[] = [];

  for (let op = 0; op < 6; op++) {
    const name = `OP${op + 1}`;
    const get = () => store.get().dxOperators[op];
    const row = document.createElement('tr');
    row.className = 'op-row voice-row';

    const head = document.createElement('th');
    head.scope = 'row';
    const tag = document.createElement('span');
    tag.className = 'op-tag';
    tag.textContent = name;
    head.append(tag);
    const role = document.createElement('td');
    role.className = 'op-role';

    const cell = (className: string, label: string, ...content: HTMLElement[]) => {
      const td = document.createElement('td');
      td.className = className;
      // Its column's name, shown only where the table is cards (phones).
      const heading = document.createElement('span');
      heading.className = 'op-cell-label';
      heading.textContent = label;
      heading.setAttribute('aria-hidden', 'true');
      td.append(heading, ...content);
      return td;
    };

    const ratio = createParam({
      name: `${name} ratio`,
      min: DX7_RATIO.min,
      max: SLIDER_TOP,
      step: 0.01,
      slider: true,
      get: () => get().ratio,
      set: value => value !== null && setDxOperator(store, op, { ratio: within(value, DX7_RATIO) }),
      show: value => String(Number((value ?? 1).toFixed(2))),
      parse: typedNumber,
      say: value => `ratio ${Number((value ?? 1).toFixed(2))}`,
      fromSlider: (position, fine) => (fine ? Number(position.toFixed(2)) : snapDx7Ratio(position)),
      toSlider: value => Math.min(SLIDER_TOP, value ?? 1),
      stepKey: (value, direction) => stepDx7Ratio(value ?? 1, direction),
      scrub: (start, pixels, fine) => {
        if (fine) return within(Number(((start ?? 1) + pixels * 0.01).toFixed(2)), DX7_RATIO);
        let r = start ?? 1;
        const stops = Math.trunc(pixels / 10);
        for (let i = 0; i < Math.abs(stops); i++) r = stepDx7Ratio(r, stops > 0 ? 1 : -1);
        return r;
      },
    });
    const detune = createParam({
      name: `${name} detune in cents`,
      min: DETUNE_CENTS.min,
      max: DETUNE_CENTS.max,
      step: 0.1,
      slider: false,
      get: () => get().detune,
      set: value => value !== null && setDxOperator(store, op, { detune: within(value, DETUNE_CENTS) }),
      show: value => formatCents(value ?? 0),
      parse: text => typedNumber(text.replace('+', '')),
      say: value => `${formatCents(value ?? 0)} cents`,
      scrub: (start, pixels, fine) =>
        within(Number(((start ?? 0) + pixels * (fine ? 0.02 : 0.1)).toFixed(1)), DETUNE_CENTS),
    });
    const level = createParam({
      name: `${name} level in dB`,
      min: LEVEL_DB.min,
      max: LEVEL_DB.max,
      step: 0.5,
      slider: true,
      get: () => get().level,
      set: value => setDxOperator(store, op, { level: value === null ? null : within(value, LEVEL_DB) }),
      show: value => (value === null ? 'off' : value.toFixed(1)),
      parse: text => (/^\s*off\s*$/i.test(text) ? null : typedNumber(text)),
      say: value => (value === null ? 'off' : formatDb(value)),
      fromSlider: position => (position <= LEVEL_OFF ? null : position),
      toSlider: value => (value === null ? LEVEL_OFF : value),
      scrub: (start, pixels, fine) => {
        const from = start ?? LEVEL_OFF;
        const to = Number((from + pixels * (fine ? 0.05 : 0.25)).toFixed(1));
        return to <= LEVEL_OFF ? null : within(to, LEVEL_DB);
      },
    });

    // Its share of the LFO's tremolo: one of the DX7's four steps.
    const tremolo = createParam({
      name: `${name} tremolo share`,
      min: 0,
      max: 1,
      step: 1,
      slider: false,
      get: () => get().tremolo,
      set: value => value !== null && setDxOperator(store, op, { tremolo: value }),
      show: value => formatShare(value ?? 0),
      parse: parseShare,
      say: value => `${formatShare(value ?? 0)} of the tremolo`,
      stepKey: (value, direction) =>
        AMS_SHARES[Math.min(AMS_SHARES.length - 1, Math.max(0, nearestStep(value ?? 0) + direction))],
      scrub: (start, pixels) =>
        AMS_SHARES[Math.min(AMS_SHARES.length - 1, Math.max(0, nearestStep(start ?? 0) + Math.trunc(pixels / 12)))],
    });

    // The two drawings, small and read only: a click on one (or Enter or
    // Space on it) selects the row and opens that tab of the panel.
    const drawing = (className: string, tab: VoiceTab) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'voice-mini';
      const canvas = document.createElement('canvas');
      canvas.className = className;
      canvas.setAttribute('aria-hidden', 'true');
      button.append(canvas);
      button.addEventListener('click', () => open(op, tab));
      return { button, canvas };
    };
    const envelope = drawing('voice-env-mini', 'envelope');
    const keys = drawing('voice-keys', 'keys');

    row.append(
      head,
      role,
      cell('voice-ratio', 'Ratio', ratio.element),
      cell('voice-detune', 'Detune ¢', detune.element),
      cell('voice-level', 'Level dB', level.element),
      cell('voice-tremolo', 'Tremolo', tremolo.element),
      cell('voice-env', 'Envelope', envelope.button),
      cell('voice-scaling', 'Across the keyboard', keys.button),
    );
    body.append(row);

    row.addEventListener('pointerenter', () => point(op));
    row.addEventListener('pointerleave', () => {
      if (store.get().hoverOp === op) point(null);
    });
    row.addEventListener('pointerdown', () => select(op));
    row.addEventListener('focusin', () => select(op));

    updates.push(() => {
      const state = store.get();
      const o = state.dxOperators[op];
      const used = operatorsUsed(algorithm(state.algorithm)).includes(op);
      row.hidden = !used;
      const r = roleOf(state.algorithm, op);
      role.textContent = r;
      tag.dataset.role = r;
      row.classList.toggle('is-selected', state.selectedOp === op);
      row.classList.toggle('is-pointed', state.hoverOp === op);
      ratio.update();
      detune.update();
      level.update();
      tremolo.update();
      drawVoiceEnvelope(envelope.canvas, o.envelope, penOf(r), false);
      envelope.button.setAttribute('aria-label', `${name} envelope: edit it above`);
      drawKeyScaling(keys.canvas, o, penOf(r));
      keys.button.setAttribute(
        'aria-label',
        `${name} across the keyboard. ${describeKeyScaling(o, noteName)} Edit it above.`,
      );
    });
  }

  const show = () => updates.forEach(update => update());
  const changed = (state: LabState, previous: LabState) =>
    state.dxOperators !== previous.dxOperators ||
    state.algorithm !== previous.algorithm ||
    state.selectedOp !== previous.selectedOp ||
    state.hoverOp !== previous.hoverOp ||
    state.theme !== previous.theme ||
    state.chapter !== previous.chapter;
  store.subscribe((state, previous) => {
    if (changed(state, previous)) show();
  });
  // The drawings again when their canvases change size.
  new ResizeObserver(show).observe(body);
  show();
}
