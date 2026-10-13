import type { SpectralLine } from '../dsp/fmSpectrum';
import { type LabState, type LabStore, patchOf } from '../model/lab';
import { drawSpectrum } from '../viz/spectrumPlot';
import { cyclesShown, drawWaveform, motionView } from '../viz/waveformPlot';
import { formatRate } from './sliders';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * A renderer: everything a figure shows comes from the state and, for a
 * figure that moves, the time in seconds.
 */
type Draw = (state: LabState, canvas: HTMLCanvasElement, time?: number) => void;

/** The parts of the state a figure is drawn from. */
const DRAWN: (keyof LabState)[] = [
  // Whether sound is on, and "Show motion", decide if a figure moves.
  'playing',
  'motion',
  'mode',
  // The carrier moves no curve in `pm`, but it sets the Hz and ms labels.
  'carrierHz',
  'ratio',
  'index',
  'modHz',
  'deviationHz',
  'showModulator',
  'theme',
];

/**
 * Keeps a canvas showing the store. A canvas keeps no memory of what was
 * drawn on it, so it is repainted when the patch changes, and also when
 * its size, the theme or the fonts do. Changes that arrive together (a
 * slider dragged quickly) share one repaint per frame.
 *
 * @param moves whether the figure should be animating for a state. While
 *   it says so the figure is redrawn every frame with the time; otherwise
 *   only when something changes, without one.
 */
function mountFigure(
  canvas: HTMLCanvasElement,
  store: LabStore,
  draw: Draw,
  moves: (state: LabState) => boolean = () => false,
): void {
  let frame = 0;
  const run = (now: number) => {
    draw(store.get(), canvas, now / 1000);
    frame = requestAnimationFrame(run);
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(
      moves(store.get()) ? run : () => draw(store.get(), canvas),
    );
  };

  store.subscribe((state, previous) => {
    // Not for `volume`, which changes nothing drawn.
    if (DRAWN.some(key => state[key] !== previous[key])) schedule();
  });
  window.matchMedia(REDUCED_MOTION).addEventListener('change', schedule);
  new ResizeObserver(schedule).observe(canvas);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', schedule);
  void document.fonts.ready.then(schedule);
}

/** The patch in the words of the sliders that set it. */
function patchText(state: LabState): string {
  if (state.mode === 'fm') {
    return (
      `a ${state.carrierHz.toFixed(0)} Hz carrier, modulator at ` +
      `${formatRate(state.modHz)}, deviation ${state.deviationHz.toFixed(0)} Hz`
    );
  }
  const { ratio, index } = patchOf(state);
  return `ratio ${ratio.toFixed(2)}, index ${index.toFixed(2)}`;
}

/** What the spectrum shows, in words, for whoever cannot see the canvas. */
export function describeSpectrum(state: LabState, lines: SpectralLine[]): string {
  if (lines.length === 0) return `Line spectrum for ${patchText(state)}: silent.`;
  const strongest = lines.reduce((a, b) =>
    Math.abs(b.amp) > Math.abs(a.amp) ? b : a,
  );
  const negative = lines.filter(line => line.amp < 0).length;
  const count = lines.length === 1 ? '1 partial' : `${lines.length} partials`;
  return (
    `Line spectrum for ${patchText(state)}: ${count}, the strongest at ` +
    `${Number(strongest.freq.toFixed(2))} times the carrier, ` +
    `${negative} with negative phase.`
  );
}

/** What the waveform shows, in words. */
export function describeWaveform(state: LabState): string {
  const cycles = Number(cyclesShown(state).toFixed(1));
  const behind = state.showModulator ? ', with the modulator behind it' : '';
  return (
    `Waveform: ${cycles} carrier cycles of the output for ` +
    `${patchText(state)}${behind}.`
  );
}

/**
 * Whether the waveform figure should be moving: the patch has a moving
 * view, and either sound is playing or "Show motion" is on. Never for
 * someone whose device asks for reduced motion.
 */
export function waveformMoves(state: LabState, reducedMotion: boolean): boolean {
  if (reducedMotion || motionView(state) === null) return false;
  return state.playing || state.motion;
}

/**
 * What to add to the waveform's caption about its motion: how much the
 * carrier is slowed while it moves, or that it is being held still.
 */
export function motionNote(state: LabState, reducedMotion: boolean): string {
  const view = motionView(state);
  if (!view) return '';
  if (reducedMotion) {
    return 'Shown still, because this device asks for reduced motion.';
  }
  if (!waveformMoves(state, false)) return '';
  return view.slow === 1
    ? 'In motion, with the carrier at its true speed.'
    : `In motion, with the carrier drawn ${view.slow} times slower than it sounds.`;
}

/** Fig. 1 and Fig. 2, each with a text description that follows the patch. */
export function mountFigures(store: LabStore): void {
  const waveform = document.querySelector<HTMLCanvasElement>('#waveform');
  const note = document.querySelector<HTMLElement>('#waveform-note');
  const reduced = window.matchMedia(REDUCED_MOTION);
  if (waveform) {
    mountFigure(
      waveform,
      store,
      (state, canvas, time) => {
        drawWaveform(state, canvas, time);
        // Every frame while it moves, so only touch the page on a change.
        const label = describeWaveform(state);
        if (canvas.getAttribute('aria-label') !== label) {
          canvas.setAttribute('aria-label', label);
        }
        const text = motionNote(state, reduced.matches);
        if (note && note.textContent !== text) note.textContent = text;
      },
      state => waveformMoves(state, reduced.matches),
    );
  }

  const spectrum = document.querySelector<HTMLCanvasElement>('#spectrum');
  if (spectrum) {
    mountFigure(spectrum, store, (state, canvas) => {
      const lines = drawSpectrum(state, canvas);
      canvas.setAttribute('aria-label', describeSpectrum(state, lines));
    });
  }
}
