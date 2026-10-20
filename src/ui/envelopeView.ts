// The sandbox's operator panel, at the top right: the selected operator,
// which one always is (OP1 to begin with), so the panel is always open.
// Its header names the operator and its role, then two tabs, Envelope (the
// first) and Key scaling (ui/keyScalingView.ts); the tab stays
// as it is when another operator is selected. This file draws the header,
// the tabs and the Envelope tab: the curve, large, with a dot at the end
// of each part to drag, and seven knobs, one for each part's time or
// level: Attack, Peak, Decay 1, Break, Decay 2, Sustain, Release.

import { type Dx7Envelope, MAX_STAGE_SECONDS, SILENCE_DB } from '../dsp/dx7';
import type { LabState, LabStore, VoiceTab } from '../model/lab';
import {
  dotAt,
  dotDragged,
  drawVoiceEnvelope,
  type EnvelopeDot,
  largeArea,
} from '../viz/voiceEnvelopePlot';
import { createKnob } from './knob';
import { roleOf } from './operators';
import { formatDb, formatTime } from './voiceFormat';
import { penOf, setDxEnvelope } from './voiceTable';

/** The knobs, in the order the envelope runs. */
const KNOBS: { key: keyof Dx7Envelope; label: string; time: boolean }[] = [
  { key: 'attack', label: 'Attack', time: true },
  { key: 'peak', label: 'Peak', time: false },
  { key: 'decay1', label: 'Decay 1', time: true },
  { key: 'brk', label: 'Break', time: false },
  { key: 'decay2', label: 'Decay 2', time: true },
  { key: 'sustain', label: 'Sustain', time: false },
  { key: 'release', label: 'Release', time: true },
];

/** The shortest time a knob turns to. */
const SHORTEST = 0.001;

/** Builds the envelope view in `#voice-envelope` and keeps it showing the store. */
export function mountEnvelopeView(store: LabStore): void {
  const view = document.querySelector<HTMLElement>('#voice-envelope');
  const tag = document.querySelector<HTMLElement>('#voice-envelope-tag');
  const role = document.querySelector<HTMLElement>('#voice-envelope-role');
  const canvas = document.querySelector<HTMLCanvasElement>('#voice-envelope-curve');
  const knobs = document.querySelector<HTMLElement>('#voice-envelope-knobs');
  if (!view || !tag || !role || !canvas || !knobs) return;

  // The tabs: a press (at once, not on the release), a click from the
  // keyboard, or the arrow keys between them (Home and End to the ends),
  // choose one.
  const tabs = [...view.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const choose = (tab: VoiceTab) => {
    if (store.get().voiceTab !== tab) store.set({ voiceTab: tab });
  };
  tabs.forEach((button, i) => {
    // The click that follows a press finds the tab chosen already.
    button.addEventListener('pointerdown', event => {
      if (event.button === 0) choose(button.dataset.tab as VoiceTab);
    });
    button.addEventListener('click', () => choose(button.dataset.tab as VoiceTab));
    button.addEventListener('keydown', event => {
      const to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      const next = tabs[(to + tabs.length) % tabs.length];
      choose(next.dataset.tab as VoiceTab);
      next.focus();
    });
  });
  const showTab = (tab: VoiceTab) => {
    for (const button of tabs) {
      const on = button.dataset.tab === tab;
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
      if (panel) panel.hidden = !on;
    }
  };

  const op = () => store.get().selectedOp;
  const envelope = () => {
    const at = op();
    return at === null ? null : store.get().dxOperators[at].envelope;
  };

  const built = KNOBS.map(({ key, label, time }) =>
    createKnob({
      label,
      name: label,
      min: time ? SHORTEST : SILENCE_DB,
      max: time ? MAX_STAGE_SECONDS : 0,
      log: time,
      get: () => envelope()?.[key] ?? 0,
      set: value => {
        const at = op();
        if (at === null) return;
        const rounded = time ? Number(value.toPrecision(2)) : Math.round(value);
        setDxEnvelope(store, at, { [key]: rounded });
      },
      format: value => (time ? formatTime(value) : formatDb(value)),
    }),
  );
  knobs.replaceChildren(...built.map(knob => knob.element));
  const dials = [...knobs.querySelectorAll<HTMLElement>('.knob-dial')];

  // Dragging a dot sets that part's time (across) and level (up and down).
  let dragging: EnvelopeDot | null = null;
  let over: EnvelopeDot | null = null;
  const position = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    return { area: largeArea(box.width, box.height), x: event.clientX - box.left, y: event.clientY - box.top };
  };
  canvas.addEventListener('pointerdown', event => {
    const env = envelope();
    if (!env || event.button !== 0) return;
    const { area, x, y } = position(event);
    dragging = dotAt(env, area, x, y);
    if (dragging) {
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', event => {
    const env = envelope();
    const at = op();
    if (!env || at === null) return;
    const { area, x, y } = position(event);
    if (dragging) {
      setDxEnvelope(store, at, dotDragged(dragging, area, x, y));
      return;
    }
    const near = dotAt(env, area, x, y);
    if (near !== over) {
      over = near;
      canvas.style.cursor = near ? 'grab' : '';
      draw();
    }
  });
  const end = () => {
    dragging = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => {
    if (over) {
      over = null;
      draw();
    }
  });

  const draw = () => {
    const state = store.get();
    const at = state.selectedOp;
    if (at === null) return;
    const r = roleOf(state.algorithm, at);
    drawVoiceEnvelope(canvas, state.dxOperators[at].envelope, penOf(r), true, dragging ?? over);
  };

  const show = (state: LabState) => {
    const at = state.voiceModel === 'dx7' ? state.selectedOp : null;
    view.hidden = at === null;
    if (at === null) return;
    showTab(state.voiceTab);
    const name = `OP${at + 1}`;
    const r = roleOf(state.algorithm, at);
    tag.textContent = name;
    tag.dataset.role = r;
    role.textContent = r;
    built.forEach((knob, i) => {
      knob.update();
      dials[i].setAttribute('aria-label', `${name} ${KNOBS[i].label.toLowerCase()}`);
    });
    canvas.setAttribute('aria-label', describe(name, state.dxOperators[at].envelope));
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

/** The envelope in words, for whoever cannot see the curve. */
function describe(name: string, env: Dx7Envelope): string {
  return (
    `${name} envelope: attack ${formatTime(env.attack)} to ${formatDb(env.peak)}, ` +
    `decay 1 ${formatTime(env.decay1)} to the break at ${formatDb(env.brk)}, ` +
    `decay 2 ${formatTime(env.decay2)} to sustain at ${formatDb(env.sustain)}, ` +
    `release ${formatTime(env.release)}.`
  );
}
