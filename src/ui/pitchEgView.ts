// The Voice section's Pitch EG tab: the voice's pitch envelope, which
// every note runs its own copy of. Its curve (viz/pitchEnvelopePlot.ts),
// with a dot at the start and the end of each part to drag up and down
// for pitch, and eight knobs under it in the order the envelope runs:
// Start, Attack, Peak, Decay 1, Break, Decay 2, Sustain, Release. The
// pitches are two-sided knobs, four octaves either way; the parts are
// speeds, set on their knobs only. Ink on paper, as the pitch envelope
// belongs to no one operator.

import { type Dx7PitchEnvelope, PITCH_EG_SPEED, PITCH_ENVELOPE_CENTS } from '../dsp/dx7';
import type { LabStore } from '../model/lab';
import {
  describePitchEnvelope,
  drawPitchEnvelope,
  pitchArea,
  type PitchDot,
  pitchDotAt,
  pitchDragged,
  pitchScale,
} from '../viz/pitchEnvelopePlot';
import { createKnob } from './knob';
import { formatGlideSpeed, formatPitchBend } from './voiceFormat';

/** The knobs, in the order the envelope runs. */
const KNOBS: { key: keyof Dx7PitchEnvelope; label: string; pitch: boolean }[] = [
  { key: 'start', label: 'Start', pitch: true },
  { key: 'attack', label: 'Attack', pitch: false },
  { key: 'peak', label: 'Peak', pitch: true },
  { key: 'decay1', label: 'Decay 1', pitch: false },
  { key: 'brk', label: 'Break', pitch: true },
  { key: 'decay2', label: 'Decay 2', pitch: false },
  { key: 'sustain', label: 'Sustain', pitch: true },
  { key: 'release', label: 'Release', pitch: false },
];

/** Builds the Pitch EG tab and keeps it showing the store. */
export function mountPitchEgView(store: LabStore): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#inst-pitch-curve');
  const knobs = document.getElementById('inst-pitch-knobs');
  if (!canvas || !knobs) return;

  const env = () => store.get().dxPitchEnvelope;
  const set = (patch: Partial<Dx7PitchEnvelope>) => store.set({ dxPitchEnvelope: { ...env(), ...patch } });

  const built = KNOBS.map(({ key, label, pitch }) =>
    createKnob({
      label,
      name: `Pitch envelope ${label.toLowerCase()}`,
      min: pitch ? PITCH_ENVELOPE_CENTS.min : PITCH_EG_SPEED.min,
      max: pitch ? PITCH_ENVELOPE_CENTS.max : PITCH_EG_SPEED.max,
      log: !pitch,
      centre: pitch ? 0 : undefined,
      get: () => env()[key],
      // Pitches to the cent; speeds to three figures.
      set: value => set({ [key]: pitch ? Math.round(value) : Number(value.toPrecision(3)) }),
      format: pitch ? formatPitchBend : formatGlideSpeed,
    }),
  );
  knobs.replaceChildren(...built.map(knob => knob.element));

  // The scale fits the envelope, but holds still while a dot is dragged,
  // and is settled again when the drag ends.
  let scale = pitchScale(env());
  let dragging: PitchDot | null = null;
  let over: PitchDot | null = null;
  const position = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    return { area: pitchArea(box.width, box.height), x: event.clientX - box.left, y: event.clientY - box.top };
  };
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const { area, x, y } = position(event);
    dragging = pitchDotAt(env(), area, scale.reach, x, y);
    if (dragging) {
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', event => {
    const { area, x, y } = position(event);
    if (dragging) {
      set({ [dragging]: pitchDragged(area, scale.reach, y) });
      return;
    }
    const near = pitchDotAt(env(), area, scale.reach, x, y);
    if (near !== over) {
      over = near;
      canvas.style.cursor = near ? 'ns-resize' : '';
      draw();
    }
  });
  const end = () => {
    if (!dragging) return;
    dragging = null;
    scale = pitchScale(env());
    draw();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => {
    if (over && !dragging) {
      over = null;
      draw();
    }
  });

  const draw = () => drawPitchEnvelope(canvas, env(), '--ink', scale, formatPitchBend, dragging ?? over);

  const show = () => {
    if (!dragging) scale = pitchScale(env());
    built.forEach(knob => knob.update());
    canvas.setAttribute('aria-label', describePitchEnvelope(env(), formatPitchBend, formatGlideSpeed));
    draw();
  };

  store.subscribe((state, previous) => {
    if (state.dxPitchEnvelope !== previous.dxPitchEnvelope || state.chapter !== previous.chapter) show();
    else if (state.theme !== previous.theme) draw();
  });
  new ResizeObserver(draw).observe(canvas);
  show();
}
