// One number in the sandbox's operator table: a box to type it in (and to
// drag in, up or right for more, as Operators and algorithms' boxes do),
// with a slider beside it where there is room.

import { SCRUB_THRESHOLD } from './operators';

export interface ParamSpec {
  /** What a screen reader hears it called: "OP4 level". */
  name: string;
  /** The range, in the units the box shows. */
  min: number;
  max: number;
  /** The slider's step. */
  step: number;
  /** The value now, in the box's units; null for "off". */
  get: () => number | null;
  /** Takes a value in the box's units, or null for off. */
  set: (value: number | null) => void;
  /** The box's text for a value. */
  show: (value: number | null) => string;
  /** Reads typed text; undefined if it is not a value. */
  parse: (text: string) => number | null | undefined;
  /** What a screen reader hears a value as. */
  say: (value: number | null) => string;
  /** A dragged box's value: `start` moved `pixels`, slower when `fine`. */
  scrub: (start: number | null, pixels: number, fine: boolean) => number | null;
  /** A slider position as a value (to snap it, or to read "off" at its end). */
  fromSlider?: (position: number, fine: boolean) => number | null;
  /** The slider's position for a value. */
  toSlider?: (value: number | null) => number;
  /** A key's step from a value, for a slider that steps its own way. */
  stepKey?: (value: number | null, direction: 1 | -1) => number;
  /** Whether it has a slider as well as the box. */
  slider: boolean;
}

/** Keys that move a slider, and which way. */
const STEP_KEYS: Record<string, 1 | -1> = {
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
};

/** Builds a param's box (and slider). `update()` shows the value now. */
export function createParam(spec: ParamSpec): {
  element: HTMLElement;
  box: HTMLInputElement;
  slider: HTMLInputElement | null;
  update: () => void;
} {
  const element = document.createElement('div');
  element.className = 'op-param';

  let slider: HTMLInputElement | null = null;
  let fine = false;
  if (spec.slider) {
    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'slider op-slider';
    range.min = String(spec.toSlider ? spec.toSlider(spec.min) : spec.min);
    range.max = String(spec.max);
    range.step = String(spec.step);
    range.setAttribute('aria-label', spec.name);
    const hold = (event: PointerEvent | KeyboardEvent) => {
      fine = event.shiftKey || event.altKey;
    };
    range.addEventListener('pointerdown', hold);
    range.addEventListener('pointermove', hold);
    range.addEventListener('keydown', event => {
      hold(event);
      const direction = STEP_KEYS[event.key];
      if (fine || !direction || !spec.stepKey) return;
      event.preventDefault();
      spec.set(spec.stepKey(spec.get(), direction));
    });
    range.addEventListener('input', () => {
      const position = range.valueAsNumber;
      spec.set(spec.fromSlider ? spec.fromSlider(position, fine) : position);
    });
    element.append(range);
    slider = range;
  }

  const box = document.createElement('input');
  box.type = 'text';
  box.inputMode = 'decimal';
  box.className = 'op-input num';
  box.setAttribute('aria-label', `${spec.name}, typed`);
  box.autocomplete = 'off';
  box.spellcheck = false;
  element.append(box);

  const update = () => {
    const value = spec.get();
    if (slider) {
      const position = spec.toSlider ? spec.toSlider(value) : (value ?? spec.min);
      slider.value = String(position);
      const lo = Number(slider.min);
      const filled = (position - lo) / (spec.max - lo);
      slider.style.setProperty('--filled', `${(filled * 100).toFixed(2)}%`);
      slider.setAttribute('aria-valuetext', spec.say(value));
    }
    // Not while it is being typed in: that would fight the typing.
    if (document.activeElement !== box) box.value = spec.show(value);
  };

  // A box with no slider steps with the up and down arrows, where it
  // says how.
  box.addEventListener('keydown', event => {
    const direction = { ArrowUp: 1, ArrowDown: -1 }[event.key] as 1 | -1 | undefined;
    if (spec.slider || !spec.stepKey || direction === undefined) return;
    event.preventDefault();
    spec.set(spec.stepKey(spec.get(), direction));
    box.value = spec.show(spec.get());
  });

  box.addEventListener('input', () => {
    const typed = spec.parse(box.value);
    if (typed !== undefined) spec.set(typed);
  });
  // Show the value as held once the box is left, or Enter is pressed.
  box.addEventListener('change', () => {
    box.value = spec.show(spec.get());
  });

  // A drag in the box changes the value; a press that does not move is a
  // click, and the box takes the typing as ever.
  let drag: { x: number; y: number; start: number | null; moved: boolean } | null = null;
  let dragged = false;
  box.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, start: spec.get(), moved: false };
  });
  box.addEventListener('pointermove', event => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < SCRUB_THRESHOLD) return;
      drag.moved = true;
      box.setPointerCapture(event.pointerId);
      box.blur();
      box.classList.add('is-scrubbing');
    }
    event.preventDefault();
    const pixels = event.clientX - drag.x - (event.clientY - drag.y);
    spec.set(spec.scrub(drag.start, pixels, event.shiftKey || event.altKey));
  });
  const end = () => {
    if (drag?.moved) {
      dragged = true;
      window.setTimeout(() => (dragged = false), 0);
    }
    drag = null;
    box.classList.remove('is-scrubbing');
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
  box.addEventListener('click', event => {
    if (dragged) event.preventDefault();
  });
  box.addEventListener('focus', () => {
    if (dragged || drag?.moved) box.blur();
  });

  update();
  return { element, box, slider, update };
}

/** A number typed, if it is one: "−3" and "-3" alike. */
export function typedNumber(text: string): number | undefined {
  const value = Number(text.replace('−', '-').replace(',', '.').trim());
  return text.trim() !== '' && Number.isFinite(value) ? value : undefined;
}
