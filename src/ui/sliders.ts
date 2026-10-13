import {
  CARRIER_SEMITONES,
  hzToSemitones,
  INDEX,
  type LabState,
  type LabStore,
  RATIO,
  semitonesToHz,
} from '../model/lab';

/** How one slider maps onto one number in the model. */
interface SliderSpec {
  id: string;
  min: number;
  max: number;
  step: number;
  /** The slider's position for a state, and the patch for a position. */
  read: (state: LabState) => number;
  write: (position: number) => Partial<LabState>;
  /** The readout beside the slider, also what a screen reader says. */
  format: (state: LabState) => string;
}

const SLIDERS: SliderSpec[] = [
  {
    // In semitones, so the scale is logarithmic; see model/lab.ts.
    id: 'carrier',
    min: 0,
    max: CARRIER_SEMITONES,
    step: 0.25,
    read: state => hzToSemitones(state.carrierHz),
    write: position => ({ carrierHz: semitonesToHz(position) }),
    format: state => `${state.carrierHz.toFixed(1)} Hz`,
  },
  {
    // Steps of 0.05 make the whole-number ratios easy to land on.
    id: 'ratio',
    min: RATIO.min,
    max: RATIO.max,
    step: 0.05,
    read: state => state.ratio,
    write: position => ({ ratio: position }),
    format: state => state.ratio.toFixed(2),
  },
  {
    id: 'index',
    min: INDEX.min,
    max: INDEX.max,
    step: 0.01,
    read: state => state.index,
    write: position => ({ index: position }),
    format: state => state.index.toFixed(2),
  },
];

/**
 * Ties the three range inputs and their readouts to the store, both ways.
 * The inputs are in index.html; this gives them their ranges.
 */
export function mountSliders(store: LabStore): void {
  for (const spec of SLIDERS) {
    const input = document.querySelector<HTMLInputElement>(`#${spec.id}`);
    const output = document.querySelector<HTMLOutputElement>(`#${spec.id}-out`);
    if (!input || !output) continue;

    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);

    const show = (state: LabState) => {
      const position = spec.read(state);
      input.value = String(position);
      const text = spec.format(state);
      output.textContent = text;
      input.setAttribute('aria-valuetext', text);
      // The filled part of the track; see .slider in base.css.
      const filled = (position - spec.min) / (spec.max - spec.min);
      input.style.setProperty('--filled', `${(filled * 100).toFixed(2)}%`);
    };

    input.addEventListener('input', () => {
      store.set(spec.write(input.valueAsNumber));
    });
    store.subscribe(show);
    show(store.get());
  }
}
