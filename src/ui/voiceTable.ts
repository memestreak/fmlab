// The sandbox's operator table: a row per operator of its DX7 voice, the
// full width of the page. Each row has the operator's tag and role, its
// ratio (slider and box), detune in cents, level in dB (slider and box),
// a small drawing of its envelope, and its level across the keyboard. A
// row clicked or focused is the selected one: outlined, its envelope
// opened in the envelope view, and its break point and envelope speed-up
// boxes shown.

import { algorithm, operatorsUsed } from '../dsp/algorithms';
import {
  DETUNE_CENTS,
  DX7_RATIO,
  type Dx7Envelope,
  type Dx7Operator,
  LEVEL_DB,
  RATE_SCALING,
  type ScalingSide,
} from '../dsp/dx7';
import type { LabState, LabStore } from '../model/lab';
import { describeKeyScaling, depthAt, drawKeyScaling, xOfKey } from '../viz/keyScalingPlot';
import { drawVoiceEnvelope } from '../viz/voiceEnvelopePlot';
import { roleOf } from './operators';
import { createParam, typedNumber } from './paramControl';
import { formatCents, formatDb, noteName, parseNote } from './voiceFormat';

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

  const updates: (() => void)[] = [];
  const rows: HTMLTableRowElement[] = [];

  for (let op = 0; op < 6; op++) {
    const name = `OP${op + 1}`;
    const get = () => store.get().dxOperators[op];
    const row = document.createElement('tr');
    row.className = 'op-row voice-row';
    rows.push(row);

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

    // The envelope, small; a click on it opens it in the envelope view.
    const envelope = document.createElement('canvas');
    envelope.className = 'voice-env-mini';
    envelope.setAttribute('role', 'img');

    // Across the keyboard: the curve, which a drag sets (see below).
    const keys = document.createElement('canvas');
    keys.className = 'voice-keys';
    keys.tabIndex = 0;
    keys.setAttribute('role', 'img');

    // Only on the selected row: the break point and the speed-up.
    const breakBox = createParam({
      name: `${name} break point`,
      min: 21,
      max: 120,
      step: 1,
      slider: false,
      get: () => get().breakKey,
      set: value => value !== null && setDxOperator(store, op, { breakKey: within(Math.round(value), { min: 21, max: 120 }) }),
      show: value => noteName(value ?? 60),
      parse: parseNote,
      say: value => `break point ${noteName(value ?? 60)}`,
      scrub: (start, pixels) => within(Math.round((start ?? 60) + pixels / 6), { min: 21, max: 120 }),
    });
    const speed = createParam({
      name: `${name} envelope speed-up per octave`,
      min: RATE_SCALING.min,
      max: RATE_SCALING.max,
      step: 0.01,
      slider: false,
      get: () => get().rateScaling,
      set: value => value !== null && setDxOperator(store, op, { rateScaling: within(value, RATE_SCALING) }),
      show: value => (value ?? 1).toFixed(2),
      parse: text => typedNumber(text.replace(/^[×x]/, '')),
      say: value => `${(value ?? 1).toFixed(2)} times faster an octave up`,
      scrub: (start, pixels, fine) =>
        within(Number(((start ?? 1) + pixels * (fine ? 0.001 : 0.005)).toFixed(2)), RATE_SCALING),
    });
    const extras = document.createElement('div');
    extras.className = 'voice-extras';
    const times = document.createElement('span');
    times.className = 'voice-times';
    times.textContent = '×';
    times.setAttribute('aria-hidden', 'true');
    extras.append(breakBox.element, times, speed.element);

    row.append(
      head,
      role,
      cell('voice-ratio', 'Ratio', ratio.element),
      cell('voice-detune', 'Detune ¢', detune.element),
      cell('voice-level', 'Level dB', level.element),
      cell('voice-env', 'Envelope', envelope),
      cell('voice-scaling', 'Across the keyboard', keys, extras),
    );
    body.append(row);

    // Dragging in the curve: up or down at either side of the break point
    // sets that side's depth; a click that does not move turns its curve
    // from linear to exponential or back.
    let drag: { side: 'left' | 'right'; x: number; y: number; moved: boolean } | null = null;
    const sideAt = (x: number) => {
      const box = keys.getBoundingClientRect();
      const breakX = xOfKey(box.width, get().breakKey);
      return x - box.left < breakX ? 'left' : 'right';
    };
    keys.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      keys.setPointerCapture(event.pointerId);
      drag = { side: sideAt(event.clientX), x: event.clientX, y: event.clientY, moved: false };
      select(op);
    });
    keys.addEventListener('pointermove', event => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3) return;
      drag.moved = true;
      const box = keys.getBoundingClientRect();
      const depth = depthAt(get(), drag.side, box.height, event.clientY - box.top);
      setDxOperator(store, op, { [drag.side]: { ...get()[drag.side], depth } });
    });
    const toggle = (side: 'left' | 'right') => {
      const now: ScalingSide = get()[side];
      setDxOperator(store, op, { [side]: { ...now, curve: now.curve === 'lin' ? 'exp' : 'lin' } });
    };
    keys.addEventListener('pointerup', () => {
      if (drag && !drag.moved) toggle(drag.side);
      drag = null;
    });
    keys.addEventListener('pointercancel', () => {
      drag = null;
    });
    // From the keyboard: up and down for the right side's depth, with
    // Shift the left's; C turns the right's curve, Shift+C the left's.
    keys.addEventListener('keydown', event => {
      const side = event.shiftKey ? 'left' : 'right';
      const now = get()[side];
      const step = { ArrowUp: 0.25, ArrowDown: -0.25 }[event.key];
      if (step !== undefined) {
        event.preventDefault();
        const depth = Number(within(now.depth + step, { min: -6, max: 6 }).toFixed(2));
        setDxOperator(store, op, { [side]: { ...now, depth } });
      } else if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        toggle(side);
      }
    });

    row.addEventListener('pointerenter', () => point(op));
    row.addEventListener('pointerleave', () => {
      if (store.get().hoverOp === op) point(null);
    });
    row.addEventListener('pointerdown', () => select(op));
    row.addEventListener('focusin', () => {
      if (!suppressFocus) select(op);
    });

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
      extras.hidden = state.selectedOp !== op;
      ratio.update();
      detune.update();
      level.update();
      breakBox.update();
      speed.update();
      drawVoiceEnvelope(envelope, o.envelope, penOf(r), false);
      envelope.setAttribute('aria-label', `${name} envelope`);
      drawKeyScaling(keys, o, penOf(r));
      keys.setAttribute(
        'aria-label',
        `${name} across the keyboard. ${describeKeyScaling(o, noteName)} Up and down arrows set the right side's depth, with Shift the left's; C changes its curve.`,
      );
    });
  }

  let suppressFocus = false;
  /** Focus a row's first control without selecting it again (after Close). */
  window.addEventListener('fmlab:voice-row-focus', event => {
    const op = (event as CustomEvent<number>).detail;
    suppressFocus = true;
    rows[op]?.querySelector<HTMLElement>('input')?.focus();
    suppressFocus = false;
  });

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
