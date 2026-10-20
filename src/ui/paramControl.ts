// A slider in the sandbox's operator table, for the ratio and the level.
// Beside it, the value is shown and turned on a number reel
// (ui/numberReel.ts); there is no box to type in.

export interface SliderSpec {
  /** What a screen reader hears it called: "OP4 level". */
  name: string;
  /** The range, in the value's units. */
  min: number;
  max: number;
  /** The slider's step. */
  step: number;
  /** The value now; null for "off". */
  get: () => number | null;
  /** Takes a value, or null for off. */
  set: (value: number | null) => void;
  /** What a screen reader hears a value as. */
  say: (value: number | null) => string;
  /** A slider position as a value (to snap it, or to read "off" at its end). */
  fromSlider?: (position: number, fine: boolean) => number | null;
  /** The slider's position for a value. */
  toSlider?: (value: number | null) => number;
  /** A key's step from a value, for a slider that steps its own way. */
  stepKey?: (value: number | null, direction: 1 | -1) => number;
}

/** Keys that move a slider, and which way. */
const STEP_KEYS: Record<string, 1 | -1> = {
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
};

/** Builds a slider. `update()` shows the value now. */
export function createSlider(spec: SliderSpec): { element: HTMLInputElement; update: () => void } {
  let fine = false;
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'slider op-slider';
  slider.min = String(spec.toSlider ? spec.toSlider(spec.min) : spec.min);
  slider.max = String(spec.max);
  slider.step = String(spec.step);
  slider.setAttribute('aria-label', spec.name);
  const hold = (event: PointerEvent | KeyboardEvent) => {
    fine = event.shiftKey || event.altKey;
  };
  slider.addEventListener('pointerdown', hold);
  slider.addEventListener('pointermove', hold);
  slider.addEventListener('keydown', event => {
    hold(event);
    const direction = STEP_KEYS[event.key];
    if (fine || !direction || !spec.stepKey) return;
    event.preventDefault();
    spec.set(spec.stepKey(spec.get(), direction));
  });
  slider.addEventListener('input', () => {
    const position = slider.valueAsNumber;
    spec.set(spec.fromSlider ? spec.fromSlider(position, fine) : position);
  });

  const update = () => {
    const value = spec.get();
    const position = spec.toSlider ? spec.toSlider(value) : (value ?? spec.min);
    slider.value = String(position);
    const lo = Number(slider.min);
    const filled = (position - lo) / (spec.max - lo);
    slider.style.setProperty('--filled', `${(filled * 100).toFixed(2)}%`);
    slider.setAttribute('aria-valuetext', spec.say(value));
  };

  update();
  return { element: slider, update };
}
