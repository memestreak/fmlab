import type { ControlId } from '../chapters';
import {
  ATTACK,
  CARRIER_SEMITONES,
  DECAY,
  DEVIATION_HZ,
  hzToSemitones,
  INDEX,
  type LabState,
  type LabStore,
  MOD_OCTAVES,
  modHzToOctaves,
  modulatorHz,
  octavesToModHz,
  RATIO,
  RELEASE,
  semitonesToHz,
  SUSTAIN,
  VOLUME,
} from '../model/lab';

/** How one slider maps onto one number in the model. */
interface SliderSpec {
  id: ControlId;
  min: number;
  max: number;
  step: number;
  /** The slider's position for a state, and the patch for a position. */
  read: (state: LabState) => number;
  write: (position: number) => Partial<LabState>;
  /** The readout beside the slider, also what a screen reader says. */
  format: (state: LabState) => string;
}

/** A slow rate needs its decimals; a fast one does not: 0.50, 12.5, 440. */
export function formatRate(hz: number): string {
  if (hz < 9.995) return `${hz.toFixed(2)} Hz`;
  if (hz < 99.95) return `${hz.toFixed(1)} Hz`;
  return `${hz.toFixed(0)} Hz`;
}

/** A short time needs its thousandths; a long one does not: 0.005 s, 0.60 s. */
export function formatSeconds(seconds: number): string {
  return `${seconds < 0.0995 ? seconds.toFixed(3) : seconds.toFixed(2)} s`;
}

const SLIDERS: SliderSpec[] = [
  {
    // Shown as a share of the slider, not as the gain it stands for.
    id: 'volume',
    min: VOLUME.min,
    max: VOLUME.max,
    step: 0.005,
    read: state => state.volume,
    write: position => ({ volume: position }),
    format: state => `${Math.round((state.volume / VOLUME.max) * 100)}%`,
  },
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
    // Steps of 0.05 make the whole-number ratios easy to land on. The
    // readout adds what the ratio comes to: the modulator's frequency.
    id: 'ratio',
    min: RATIO.min,
    max: RATIO.max,
    step: 0.05,
    read: state => state.ratio,
    write: position => ({ ratio: position }),
    format: state =>
      `${state.ratio.toFixed(2)} · ${modulatorHz(state).toFixed(1)} Hz`,
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
  {
    // In octaves, so the slow end, where vibrato lives, gets as much of
    // the slider as the fast end.
    id: 'modHz',
    min: 0,
    max: MOD_OCTAVES,
    step: 0.01,
    read: state => modHzToOctaves(state.modHz),
    write: position => ({ modHz: octavesToModHz(position) }),
    format: state => formatRate(state.modHz),
  },
  {
    id: 'deviation',
    min: DEVIATION_HZ.min,
    max: DEVIATION_HZ.max,
    step: 1,
    read: state => state.deviationHz,
    write: position => ({ deviationHz: position }),
    format: state => `${state.deviationHz.toFixed(0)} Hz`,
  },
  // The envelope. The figure's dots set the same four numbers.
  {
    id: 'attack',
    min: ATTACK.min,
    max: ATTACK.max,
    step: 0.005,
    read: state => state.attack,
    write: position => ({ attack: position }),
    format: state => formatSeconds(state.attack),
  },
  {
    id: 'decay',
    min: DECAY.min,
    max: DECAY.max,
    step: 0.01,
    read: state => state.decay,
    write: position => ({ decay: position }),
    format: state => formatSeconds(state.decay),
  },
  {
    id: 'sustain',
    min: SUSTAIN.min,
    max: SUSTAIN.max,
    step: 0.01,
    read: state => state.sustain,
    write: position => ({ sustain: position }),
    format: state => `${Math.round(state.sustain * 100)}%`,
  },
  {
    id: 'release',
    min: RELEASE.min,
    max: RELEASE.max,
    step: 0.01,
    read: state => state.release,
    write: position => ({ release: position }),
    format: state => formatSeconds(state.release),
  },
];

/**
 * Ties the range inputs and their readouts to the store, both ways. The
 * inputs are in index.html; this gives them their ranges. Which of them a
 * chapter shows is the chapter view's business.
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
