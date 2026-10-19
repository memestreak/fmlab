// A knob: a dial that turns as it is dragged up or down, or with the keys a
// slider answers to. It is a `role="slider"` for a screen reader, as the
// Bessel plot is (besselControls.ts), drawn ink on paper with its value
// arc in a pen, with its name under it and its value under that.

/** What a knob sets. */
export interface KnobSpec {
  /** Its visible name: "Attack". */
  label: string;
  /** What a screen reader hears it called: "OP4 attack". */
  name: string;
  min: number;
  max: number;
  /** Turned on a log scale: equal turns are equal ratios (for times). */
  log?: boolean;
  /**
   * 0 at the bottom: turned all the way down it is 0, and from just above
   * there the scale runs from `min` to `max`. For a log knob that can be
   * off, as a delay or a depth.
   */
  zero?: boolean;
  /**
   * The value its arc starts from, for a value either side of it (a
   * depth from -6 to 6 dB about 0); the arc starts at the bottom otherwise.
   */
  centre?: number;
  /** The value to show. */
  get: () => number;
  /** Takes a new value, already inside the range. */
  set: (value: number) => void;
  /** The readout, which a screen reader hears too: "150 ms". */
  format: (value: number) => string;
}

/** How many pixels of drag turn a knob from end to end. */
export const KNOB_DRAG_PIXELS = 200;
/** The arc a knob turns through, in degrees each side of straight up. */
const SWEEP = 135;

/** Where a value sits on a knob, 0 (all the way down) to 1. */
export function knobPosition(spec: Pick<KnobSpec, 'min' | 'max' | 'log' | 'zero'>, value: number): number {
  const { min, max } = spec;
  if (value <= min) return 0;
  if (value >= max) return 1;
  return spec.log ? Math.log(value / min) / Math.log(max / min) : (value - min) / (max - min);
}

/** The value at a position on a knob, 0 to 1. */
export function knobValue(spec: Pick<KnobSpec, 'min' | 'max' | 'log' | 'zero'>, position: number): number {
  const p = Math.min(1, Math.max(0, position));
  const { min, max } = spec;
  if (spec.zero && p === 0) return 0;
  return spec.log ? min * (max / min) ** p : min + (max - min) * p;
}

/**
 * The position a key moves a knob to from `position`, or null for a key
 * that does not move it: an arrow a hundredth of the way, Page Up or Down
 * a tenth, Home and End to the ends.
 */
export function knobAfterKey(position: number, key: string): number | null {
  const moves: Record<string, number> = {
    ArrowUp: position + 0.01,
    ArrowRight: position + 0.01,
    ArrowDown: position - 0.01,
    ArrowLeft: position - 0.01,
    PageUp: position + 0.1,
    PageDown: position - 0.1,
    Home: 0,
    End: 1,
  };
  return key in moves ? Math.min(1, Math.max(0, moves[key])) : null;
}

const SVG = 'http://www.w3.org/2000/svg';

/** An SVG arc from angle `a` to `b`, degrees clockwise from straight up. */
function arc(a: number, b: number, r: number): string {
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(20 + r * Math.sin(rad)).toFixed(2)} ${(20 - r * Math.cos(rad)).toFixed(2)}`;
  };
  const large = b - a > 180 ? 1 : 0;
  return `M ${point(a)} A ${r} ${r} 0 ${large} 1 ${point(b)}`;
}

/**
 * Builds a knob. `update()` redraws it from `spec.get()`; call it when the
 * value may have changed. The pen is the CSS variable --knob-pen, set on
 * the knob or anything around it.
 */
export function createKnob(spec: KnobSpec): { element: HTMLElement; update: () => void } {
  const element = document.createElement('div');
  element.className = 'knob';

  const dial = document.createElement('div');
  dial.className = 'knob-dial';
  dial.tabIndex = 0;
  dial.setAttribute('role', 'slider');
  dial.setAttribute('aria-label', spec.name);
  dial.setAttribute('aria-valuemin', '0');
  dial.setAttribute('aria-valuemax', '100');

  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('aria-hidden', 'true');
  const track = document.createElementNS(SVG, 'path');
  track.setAttribute('class', 'knob-track');
  track.setAttribute('d', arc(-SWEEP, SWEEP, 15));
  const value = document.createElementNS(SVG, 'path');
  value.setAttribute('class', 'knob-value-arc');
  const face = document.createElementNS(SVG, 'circle');
  face.setAttribute('class', 'knob-face');
  face.setAttribute('cx', '20');
  face.setAttribute('cy', '20');
  face.setAttribute('r', '10.5');
  const pointer = document.createElementNS(SVG, 'line');
  pointer.setAttribute('class', 'knob-pointer');
  pointer.setAttribute('x1', '20');
  pointer.setAttribute('y1', '20');
  svg.append(track, value, face, pointer);
  dial.append(svg);

  const label = document.createElement('span');
  label.className = 'knob-label';
  label.textContent = spec.label;
  label.setAttribute('aria-hidden', 'true');
  const readout = document.createElement('output');
  readout.className = 'knob-readout num';
  readout.setAttribute('aria-hidden', 'true');
  element.append(dial, label, readout);

  const turnTo = (position: number) => {
    spec.set(knobValue(spec, position));
  };

  const update = () => {
    const now = spec.get();
    const position = knobPosition(spec, now);
    const angle = -SWEEP + 2 * SWEEP * position;
    const from = spec.centre === undefined ? -SWEEP : -SWEEP + 2 * SWEEP * knobPosition(spec, spec.centre);
    const [a, b] = angle < from ? [angle, from] : [from, angle];
    value.setAttribute('d', b - a > 0.6 ? arc(a, b, 15) : '');
    const rad = (angle * Math.PI) / 180;
    pointer.setAttribute('x2', (20 + 8 * Math.sin(rad)).toFixed(2));
    pointer.setAttribute('y2', (20 - 8 * Math.cos(rad)).toFixed(2));
    const text = spec.format(now);
    readout.textContent = text;
    dial.setAttribute('aria-valuenow', String(Math.round(position * 100)));
    dial.setAttribute('aria-valuetext', text);
  };

  // Up for more, down for less, from wherever the press started.
  let drag: { y: number; from: number } | null = null;
  dial.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    dial.setPointerCapture(event.pointerId);
    drag = { y: event.clientY, from: knobPosition(spec, spec.get()) };
    event.preventDefault();
    dial.focus();
  });
  dial.addEventListener('pointermove', event => {
    if (!drag) return;
    const slow = event.shiftKey || event.altKey ? 5 : 1;
    turnTo(drag.from + (drag.y - event.clientY) / (KNOB_DRAG_PIXELS * slow));
  });
  const end = () => {
    drag = null;
  };
  dial.addEventListener('pointerup', end);
  dial.addEventListener('pointercancel', end);
  dial.addEventListener('keydown', event => {
    const next = knobAfterKey(knobPosition(spec, spec.get()), event.key);
    if (next === null) return;
    event.preventDefault();
    turnTo(next);
  });

  update();
  return { element, update };
}
