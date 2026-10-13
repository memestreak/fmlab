import type { SpectralLine } from '../dsp/fmSpectrum';
import type { LabState, LabStore } from '../model/lab';
import { drawSpectrum } from '../viz/spectrumPlot';
import { CYCLES_SHOWN, drawWaveform } from '../viz/waveformPlot';

/** A renderer: everything a figure shows comes from the state. */
type Draw = (state: LabState, canvas: HTMLCanvasElement) => void;

/**
 * Keeps a canvas showing the store. A canvas keeps no memory of what was
 * drawn on it, so it is repainted when the patch changes, and also when
 * its size, the theme or the fonts do. Changes that arrive together (a
 * slider dragged quickly) share one repaint per frame.
 */
function mountFigure(canvas: HTMLCanvasElement, store: LabStore, draw: Draw): void {
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => draw(store.get(), canvas));
  };

  store.subscribe((state, previous) => {
    // Not for `playing` or `volume`, which change nothing drawn. The
    // carrier moves no curve, but it does change the Hz and ms labels.
    if (
      state.ratio !== previous.ratio ||
      state.index !== previous.index ||
      state.carrierHz !== previous.carrierHz ||
      state.theme !== previous.theme
    ) {
      schedule();
    }
  });
  new ResizeObserver(schedule).observe(canvas);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', schedule);
  void document.fonts.ready.then(schedule);
}

const patchText = ({ ratio, index }: LabState) =>
  `ratio ${ratio.toFixed(2)}, index ${index.toFixed(2)}`;

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

/** Fig. 1 and Fig. 2, each with a text description that follows the patch. */
export function mountFigures(store: LabStore): void {
  const waveform = document.querySelector<HTMLCanvasElement>('#waveform');
  if (waveform) {
    mountFigure(waveform, store, (state, canvas) => {
      drawWaveform(state, canvas);
      canvas.setAttribute(
        'aria-label',
        `Waveform: ${CYCLES_SHOWN} carrier cycles of the output for ` +
          `${patchText(state)}, with the modulator behind it.`,
      );
    });
  }

  const spectrum = document.querySelector<HTMLCanvasElement>('#spectrum');
  if (spectrum) {
    mountFigure(spectrum, store, (state, canvas) => {
      const lines = drawSpectrum(state, canvas);
      canvas.setAttribute('aria-label', describeSpectrum(state, lines));
    });
  }
}
