import { noteSeconds } from '../dsp/envelope';
import type { SpectralLine } from '../dsp/fmSpectrum';
import {
  envelopeOf,
  type LabState,
  type LabStore,
  noteSounding,
  patchOf,
} from '../model/lab';
import { describeAlgorithm, drawAlgorithm } from '../viz/algorithmPlot';
import { drawBessel } from '../viz/besselPlot';
import { drawEnvelope } from '../viz/envelopePlot';
import { drawSpectrogram, sliceAt } from '../viz/spectrogramPlot';
import { drawLiveSpectrum } from '../viz/liveSpectrum';
import { drawSpectrum, spectrumOf } from '../viz/spectrumPlot';
import type { AudioEngine } from '../audio/engine';
import {
  cyclesShown,
  drawWaveform,
  motionView,
  REAL_SECONDS,
} from '../viz/waveformPlot';
import { formatRate, formatSeconds } from './sliders';

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
  'showBandwidth',
  'realUnits',
  'showHarmonics',
  'liveSpectrum',
  'algorithm',
  'operators',
  'feedback',
  // The envelope, and the note whose playhead the figures show.
  'attack',
  'decay',
  'sustain',
  'release',
  'hold',
  'indexFollows',
  'noteStartedAt',
  // The sideband order picked out in the linked figures.
  'hover',
  'pinned',
  'theme',
];

/**
 * Keeps a canvas showing the store. A canvas keeps no memory of what was
 * drawn on it, so it is repainted when the patch changes, and also when
 * its size, the theme or the fonts do. Changes that arrive together (a
 * slider dragged quickly) share one repaint per frame.
 *
 * @param moves whether the figure should be animating for a state at a
 *   time, in seconds on the page's clock. While it says so the figure is
 *   redrawn every frame with the time; when it stops saying so the figure
 *   is drawn once more without one, and then only when something changes.
 */
function mountFigure(
  canvas: HTMLCanvasElement,
  store: LabStore,
  draw: Draw,
  moves: (state: LabState, time: number) => boolean = () => false,
): void {
  let frame = 0;
  const run = (now: number) => {
    const state = store.get();
    const time = now / 1000;
    if (moves(state, time)) {
      draw(state, canvas, time);
      frame = requestAnimationFrame(run);
    } else {
      draw(state, canvas);
    }
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(run);
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
  const patch = `ratio ${ratio.toFixed(2)}, index ${index.toFixed(2)}`;
  // Where the figures are in real units the carrier is part of the story.
  return state.realUnits
    ? `a ${state.carrierHz.toFixed(1)} Hz carrier, ${patch}`
    : patch;
}

/** What the spectrum shows, in words, for whoever cannot see the canvas. */
export function describeSpectrum(state: LabState, lines: SpectralLine[]): string {
  if (lines.length === 0) return `Line spectrum for ${patchText(state)}: silent.`;
  const strongest = lines.reduce((a, b) =>
    Math.abs(b.amp) > Math.abs(a.amp) ? b : a,
  );
  const negative = lines.filter(line => line.amp < 0).length;
  const count = lines.length === 1 ? '1 partial' : `${lines.length} partials`;
  const where = state.realUnits
    ? `${(strongest.freq * state.carrierHz).toFixed(1)} Hz`
    : `${Number(strongest.freq.toFixed(2))} times the carrier`;
  return (
    `Line spectrum for ${patchText(state)}: ${count}, the strongest at ` +
    `${where}, ${negative} with negative phase.`
  );
}

/** What the waveform shows, in words. */
export function describeWaveform(state: LabState): string {
  const length = state.realUnits
    ? `${REAL_SECONDS * 1000} ms`
    : `${Number(cyclesShown(state).toFixed(1))} carrier cycles`;
  const behind = state.showModulator ? ', with the modulator behind it' : '';
  return (
    `Waveform: ${length} of the output for ` +
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
export function mountFigures(store: LabStore, engine: AudioEngine): void {
  const spectrumNote = document.querySelector<HTMLElement>('#spectrum-note');
  /** When the live view was last drawn, for reduced motion. */
  let lastLive = 0;
  const waveform = document.querySelector<HTMLCanvasElement>('#waveform');
  const note = document.querySelector<HTMLElement>('#waveform-note');
  const reduced = window.matchMedia(REDUCED_MOTION);
  /** Whether a figure should be following a note that is sounding. */
  const noteMoves = (state: LabState, time: number) =>
    noteHasPlayhead(state, time, reduced.matches);
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
      // A slow vibrato squeezing and stretching, or a note sounding.
      (state: LabState, time: number) =>
        waveformMoves(state, reduced.matches) || noteMoves(state, time),
    );
  }

  const spectrum = document.querySelector<HTMLCanvasElement>('#spectrum');
  if (spectrum) {
    mountFigure(
      spectrum,
      store,
      (state, canvas, time) => {
        const now = time ?? performance.now() / 1000;
        if (state.liveSpectrum) {
          // Under reduced motion the live view moves only a few times a
          // second; each time is a still picture of the sound.
          if (time !== undefined && reduced.matches && now - lastLive < CALM_SECONDS) return;
          lastLive = now;
          drawLiveSpectrum(state, canvas, isSounding(state, now) ? engine.measure() : null);
        } else {
          drawSpectrum(state, canvas, time);
        }
        // The description is of the patch as set, not of each moment of a
        // note: a screen reader has no use for sixty of them a second.
        const label = state.liveSpectrum
          ? describeLive(isSounding(state, now))
          : describeSpectrum(state, spectrumOf(state));
        if (canvas.getAttribute('aria-label') !== label) {
          canvas.setAttribute('aria-label', label);
        }
        const text = liveNote(state, isSounding(state, now));
        if (spectrumNote && spectrumNote.textContent !== text) {
          spectrumNote.textContent = text;
        }
      },
      // A note sounding, or the live view of anything sounding.
      (state: LabState, time: number) =>
        noteMoves(state, time) || (state.liveSpectrum && isSounding(state, time)),
    );
  }

  // The Predicted / Live switch.
  const predicted = document.querySelector<HTMLButtonElement>('#spectrum-predicted');
  const live = document.querySelector<HTMLButtonElement>('#spectrum-live');
  const showSwitch = (state: LabState) => {
    predicted?.setAttribute('aria-pressed', String(!state.liveSpectrum));
    live?.setAttribute('aria-pressed', String(state.liveSpectrum));
  };
  predicted?.addEventListener('click', () => store.set({ liveSpectrum: false }));
  live?.addEventListener('click', () => store.set({ liveSpectrum: true }));
  store.subscribe(showSwitch);
  showSwitch(store.get());

  // Chapter 8's algorithm, as the DX7 draws it.
  const diagram = document.querySelector<HTMLCanvasElement>('#algorithm-plot');
  if (diagram) {
    mountFigure(diagram, store, (state, canvas) => {
      drawAlgorithm(state, canvas);
      canvas.setAttribute('aria-label', describeAlgorithm(state.algorithm));
    });
  }

  // Its label and value are the slider's, kept by ui/besselControls.ts.
  const bessel = document.querySelector<HTMLCanvasElement>('#bessel');
  if (bessel) mountFigure(bessel, store, drawBessel);

  // The two figures of a note share a playhead while the note sounds.
  const playheadMoves = noteMoves;
  const envelope = document.querySelector<HTMLCanvasElement>('#envelope');
  if (envelope) {
    mountFigure(
      envelope,
      store,
      (state, canvas, time) => {
        drawEnvelope(state, canvas, time);
        const label = describeEnvelope(state);
        if (canvas.getAttribute('aria-label') !== label) {
          canvas.setAttribute('aria-label', label);
        }
      },
      playheadMoves,
    );
  }
  const spectrogram = document.querySelector<HTMLCanvasElement>('#spectrogram');
  if (spectrogram) {
    mountFigure(
      spectrogram,
      store,
      (state, canvas, time) => {
        drawSpectrogram(state, canvas, time);
        const label = describeSpectrogram(state);
        if (canvas.getAttribute('aria-label') !== label) {
          canvas.setAttribute('aria-label', label);
        }
      },
      playheadMoves,
    );
  }
}

/** Under reduced motion, the live view is redrawn no oftener than this. */
const CALM_SECONDS = 0.5;

/** Whether anything is sounding at `time`: a steady sound, or a note. */
export function isSounding(state: LabState, time: number): boolean {
  return state.playing || (state.noteMode && noteSounding(state, time));
}

/** What to add to the spectrum's caption in the live view; nothing otherwise. */
export function liveNote(state: LabState, sounding: boolean): string {
  if (!state.liveSpectrum) return '';
  return sounding
    ? 'Live: measured, over the predicted stems.'
    : 'Press Play to hear it.';
}

/** What the live view shows, in words. */
export function describeLive(sounding: boolean): string {
  return sounding
    ? 'Live spectrum, measured from the sound now playing, drawn over the predicted lines.'
    : 'Live spectrum: nothing is playing, so it lies flat.';
}

/**
 * Whether the note figures should be redrawing every frame for the
 * playhead: a note has been asked for and is not over at `time`. That
 * includes the instant before it starts, when there is no line to draw
 * yet: the frame a note is asked in carries a time a little before the
 * note's own start, and stopping there would mean never starting. Never
 * for someone whose device asks for reduced motion; for them the figures
 * stay as they are, which loses nothing but the line.
 */
export function noteHasPlayhead(
  state: LabState,
  time: number,
  reducedMotion: boolean,
): boolean {
  if (reducedMotion || state.noteStartedAt === null) return false;
  return time <= state.noteStartedAt + state.noteLength;
}

/** What the envelope figure shows, in words. */
export function describeEnvelope(state: LabState): string {
  const { attack, decay, sustain, release, hold } = envelopeOf(state);
  const index = state.indexFollows
    ? `the index follows it up to ${state.index.toFixed(2)}`
    : `the index stays at ${state.index.toFixed(2)}`;
  return (
    `Envelope: attack ${formatSeconds(attack)}, decay ${formatSeconds(decay)}, ` +
    `sustain ${Math.round(sustain * 100)}%, let go after ${formatSeconds(hold)}, ` +
    `release ${formatSeconds(release)}; ${index}.`
  );
}

/** What the spectrogram shows, in words. */
export function describeSpectrogram(state: LabState): string {
  const seconds = noteSeconds(envelopeOf(state));
  // The note at its brightest: when the envelope peaks.
  const peak = sliceAt(state, Math.min(state.attack, state.hold)).marks.length;
  const end = sliceAt(state, seconds).marks.length;
  const partials = (count: number) =>
    count === 1 ? '1 partial' : `${count} partials`;
  return (
    `Spectrogram of a ${formatSeconds(seconds)} note at ratio ` +
    `${patchOf(state).ratio.toFixed(2)}: ${partials(peak)} at its peak, ` +
    `${partials(end)} at its end.`
  );
}
