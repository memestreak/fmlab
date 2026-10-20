// The operator panel's Key scaling tab: the selected operator's
// level across the keyboard, large, and everything that sets it and its
// envelope's speed-up up the keyboard. The curve: up or down at either
// side of the break point sets that side's depth, a click turns its curve
// from linear to exponential or back, and the break point's line drags
// sideways. Under it, in the order of the keyboard: the left side's curve
// and depth, the break point, the right side's depth and curve, and the
// speed-up.

import { type Dx7Operator, levelScalingDb, RATE_SCALING, SCALING_DEPTH, type ScalingSide } from '../dsp/dx7';
import type { LabState, LabStore } from '../model/lab';
import {
  depthAt,
  describeKeyScaling,
  drawKeyScaling,
  FIRST_KEY,
  keyAt,
  keysArea,
  keyX,
  LAST_KEY,
} from '../viz/keyScalingPlot';
import { knobValues, redrawOnLayout } from './screenValues';
import { createKnob } from './knob';
import { roleOf } from './operators';
import { noteName } from './voiceFormat';
import { penOf, setDxOperator } from './voiceTable';

/** The break point's range: A-1 to C9, as the DX7's. */
const BREAK = { min: 21, max: 120 };
/** How near the break point's line, in pixels, a press drags it. */
const BREAK_REACH = 6;

type Side = 'left' | 'right';

const within = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, value));

/** How much louder (+) or quieter one side ends up at its end of the keyboard. */
const endDb = (op: Dx7Operator, side: Side) => levelScalingDb(op, side === 'left' ? FIRST_KEY : LAST_KEY);

const signedDb = (db: number) => {
  const brief = Number(db.toFixed(1));
  return `${brief > 0 ? '+' : ''}${brief} dB`;
};

/** Builds the tab in `#voice-keys-panel` and keeps it showing the store. */
export function mountKeyScalingView(store: LabStore): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#voice-keys-curve');
  const controls = document.querySelector<HTMLElement>('#voice-keys-knobs');
  if (!canvas || !controls) return;

  const op = () => store.get().selectedOp;
  const get = () => store.get().dxOperators[op()];
  const set = (patch: Partial<Dx7Operator>) => setDxOperator(store, op(), patch);
  const toggle = (side: Side) => {
    const now: ScalingSide = get()[side];
    set({ [side]: { ...now, curve: now.curve === 'lin' ? 'exp' : 'lin' } });
  };

  const depthKnob = (side: Side) =>
    createKnob({
      label: side === 'left' ? 'Left depth' : 'Right depth',
      name: `${side} depth`,
      min: SCALING_DEPTH.min,
      max: SCALING_DEPTH.max,
      centre: 0,
      get: () => get()[side].depth,
      set: value => set({ [side]: { ...get()[side], depth: Number(value.toFixed(2)) } }),
      // What it does at its end of the keyboard, which a depth alone
      // does not say: the curve reaches further when it is exponential.
      format: () => signedDb(endDb(get(), side)),
    });

  // A side's curve, linear or exponential: a button where a knob would be.
  const curveButton = (side: Side) => {
    const element = document.createElement('div');
    element.className = 'knob';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'knob-toggle';
    button.addEventListener('click', () => toggle(side));
    const label = document.createElement('span');
    label.className = 'knob-label';
    label.textContent = side === 'left' ? 'Left curve' : 'Right curve';
    label.setAttribute('aria-hidden', 'true');
    const readout = document.createElement('span');
    readout.className = 'knob-readout num';
    readout.setAttribute('aria-hidden', 'true');
    element.append(button, label, readout);
    const update = () => {
      const lin = get()[side].curve === 'lin';
      button.textContent = lin ? 'lin' : 'exp';
      readout.textContent = lin ? 'linear' : 'expon.';
      button.setAttribute(
        'aria-label',
        `OP${op() + 1} ${side} curve: ${lin ? 'linear' : 'exponential'}. Press for ${lin ? 'exponential' : 'linear'}.`,
      );
    };
    return { element, update };
  };

  const leftCurve = curveButton('left');
  const leftDepth = depthKnob('left');
  const breakKnob = createKnob({
    label: 'Break point',
    name: 'break point',
    min: BREAK.min,
    max: BREAK.max,
    get: () => get().breakKey,
    set: value => set({ breakKey: Math.round(value) }),
    format: noteName,
  });
  const rightDepth = depthKnob('right');
  const rightCurve = curveButton('right');
  const speed = createKnob({
    label: 'Speed-up',
    name: 'envelope speed-up per octave',
    min: RATE_SCALING.min,
    max: RATE_SCALING.max,
    get: () => get().rateScaling,
    set: value => set({ rateScaling: Number(value.toFixed(2)) }),
    format: value => `×${value.toFixed(2)}`,
  });
  const parts = [leftCurve, leftDepth, breakKnob, rightDepth, rightCurve, speed];
  controls.replaceChildren(...parts.map(part => part.element));
  const knobNames: [HTMLElement | null, string][] = [
    [leftDepth.element.querySelector('.knob-dial'), 'left depth'],
    [breakKnob.element.querySelector('.knob-dial'), 'break point'],
    [rightDepth.element.querySelector('.knob-dial'), 'right depth'],
    [speed.element.querySelector('.knob-dial'), 'envelope speed-up per octave'],
  ];

  // The curve: press near the break point's line to drag it sideways;
  // elsewhere, drag up or down to set that side's depth, or click to turn
  // its curve.
  type Drag = { what: Side | 'break'; x: number; y: number; moved: boolean };
  let drag: Drag | null = null;
  const where = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    return { area: keysArea(box.width, box.height, true), x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const nearBreak = (event: PointerEvent) => {
    const { area, x } = where(event);
    return Math.abs(x - keyX(area, get().breakKey)) <= BREAK_REACH;
  };
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    const { area, x } = where(event);
    const what = nearBreak(event) ? 'break' : x < keyX(area, get().breakKey) ? 'left' : 'right';
    drag = { what, x: event.clientX, y: event.clientY, moved: false };
    event.preventDefault();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) {
      canvas.style.cursor = nearBreak(event) ? 'ew-resize' : 'ns-resize';
      return;
    }
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3) return;
    drag.moved = true;
    const { area, x, y } = where(event);
    if (drag.what === 'break') {
      set({ breakKey: within(keyAt(area, x), BREAK) });
    } else {
      set({ [drag.what]: { ...get()[drag.what], depth: depthAt(get(), drag.what, area, y) } });
    }
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && !drag.moved && drag.what !== 'break') toggle(drag.what);
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => {
    drag = null;
  });
  // From the keyboard: up and down for the right side's depth, with Shift
  // the left's; left and right move the break point; C turns the right's
  // curve, Shift+C the left's.
  canvas.addEventListener('keydown', event => {
    const side = event.shiftKey ? 'left' : 'right';
    const now = get()[side];
    const step = { ArrowUp: 0.25, ArrowDown: -0.25 }[event.key];
    const move = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (step !== undefined) {
      event.preventDefault();
      set({ [side]: { ...now, depth: Number(within(now.depth + step, SCALING_DEPTH).toFixed(2)) } });
    } else if (move !== undefined) {
      event.preventDefault();
      set({ breakKey: within(get().breakKey + move, BREAK) });
    } else if (event.key.toLowerCase() === 'c') {
      event.preventDefault();
      toggle(side);
    }
  });

  const draw = () => {
    const state = store.get();
    const at = state.selectedOp;
    drawKeyScaling(canvas, state.dxOperators[at], penOf(roleOf(state.algorithm, at)), {
      name: noteName,
      values: knobValues(canvas, controls),
    });
  };
  redrawOnLayout(controls, draw);

  const show = (state: LabState) => {
    if (state.voiceModel !== 'dx7') return;
    const name = `OP${state.selectedOp + 1}`;
    parts.forEach(part => part.update());
    for (const [dial, what] of knobNames) dial?.setAttribute('aria-label', `${name} ${what}`);
    canvas.setAttribute(
      'aria-label',
      `${name} key scaling. ${describeKeyScaling(get(), noteName)} Up and down arrows set the right side's depth, with Shift the left's; left and right move the break point; C changes the curve.`,
    );
    draw();
  };

  store.subscribe((state, previous) => {
    if (
      state.selectedOp !== previous.selectedOp ||
      state.dxOperators !== previous.dxOperators ||
      state.algorithm !== previous.algorithm ||
      state.voiceModel !== previous.voiceModel ||
      state.voiceTab !== previous.voiceTab ||
      state.theme !== previous.theme
    ) {
      show(state);
    }
  });
  new ResizeObserver(draw).observe(canvas);
  show(store.get());
}
