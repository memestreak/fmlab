import { noteSeconds } from '../dsp/envelope';
import type { SpectralLine } from '../dsp/fmSpectrum';
import {
  envelopeOf,
  type LabState,
  type LabStore,
  asFm,
  asPm,
  noteSounding,
  patchOf,
} from '../model/lab';
import { describeAlgorithm, drawAlgorithm } from '../viz/algorithmPlot';
import { drawBessel } from '../viz/besselPlot';
import { drawEnvelope } from '../viz/envelopePlot';
import { drawSpectrogram, sliceAt } from '../viz/spectrogramPlot';
import { drawLiveSpectrum } from '../viz/liveSpectrum';
import { ampDb, DB_FLOOR, drawSpectrum, isLogSpectrum, LOG_HZ, spectrumOf } from '../viz/spectrumPlot';
import type { AudioEngine } from '../audio/engine';
import { motionReduced, onMotionChange } from './motion';
import {
  cyclesShown,
  drawWaveform,
  motionView,
  REAL_SECONDS,
} from '../viz/waveformPlot';
import { formatRate, formatSeconds } from './sliders';


/**
 * A renderer: everything a figure shows comes from the state and, for a
 * figure that moves, the time in seconds.
 */
type Draw = (state: LabState, canvas: HTMLCanvasElement, time?: number) => void;

/** The parts of the state a figure is drawn from. */
const DRAWN: (keyof LabState)[] = [
  // Whether sound is on decides if a figure moves.
  'playing',
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
  'compare',
  'algorithm',
  'operators',
  'feedback',
  'voiceModel',
  'dxOperators',
  'dxFeedback',
  // The envelope, and the note whose playhead the figures show.
  'attack',
  'decay',
  'sustain',
  'release',
  'hold',
  'indexFollows',
  'noteStartedAt',
  'noteLength',
  'noteHold',
  'noteVelocity',
  // The sideband order picked out in the linked figures.
  'hover',
  'pinned',
  // The operator picked out in the wiring diagram.
  'hoverOp',
  'theme',
];

/** Everything drawn, as `mountFigure` compares it. */
const drawnOf = (state: LabState): readonly unknown[] => DRAWN.map(key => state[key]);

/**
 * Everything drawn but the six operators: in the sandbox they reach the
 * diagram only through a sounding note's levels, when it animates anyway.
 */
const drawnButOperators = (state: LabState): readonly unknown[] =>
  DRAWN.filter(key => key !== 'dxOperators').map(key => state[key]);

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
 * @param inputs what the figure shows depends on, when that is narrower
 *   than everything drawn (`DRAWN`): it is repainted only when one of
 *   these changes. The sandbox's diagram and spectrum use it, so that
 *   turning an envelope knob, which changes the operators but neither of
 *   them, does not repaint them sixty times a second.
 */
function mountFigure(
  canvas: HTMLCanvasElement,
  store: LabStore,
  draw: Draw,
  moves: (state: LabState, time: number) => boolean = () => false,
  inputs: (state: LabState) => readonly unknown[] = drawnOf,
): void {
  let frame = 0;
  const run = (now: number) => {
    // Not drawn, nor animated, while the page hides it (the sandbox's
    // waveform, say): it has no box. The ResizeObserver below draws it
    // once it has one again, and starts it moving if it should.
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
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

  let shown = inputs(store.get());
  store.subscribe(state => {
    // Not for `volume`, which changes nothing drawn.
    const now = inputs(state);
    if (now.some((value, i) => value !== shown[i])) {
      shown = now;
      schedule();
    }
  });
  onMotionChange(schedule);
  // Its size changing, and its being shown again after hidden (0 to a size).
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
export function describeSpectrum(
  state: LabState,
  lines: SpectralLine[],
  measured = false,
): string {
  // While sound plays, its measured spectrum is drawn over the stems.
  const over = measured ? ' Measured from the sound now playing, drawn over them.' : '';
  if (isLogSpectrum(state)) return describeLogSpectrum(state, lines, over);
  if (lines.length === 0) return `Line spectrum for ${patchText(state)}: silent.${over}`;
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
    `${where}, ${negative} with negative phase.${over}`
  );
}

/**
 * The sandbox's spectrum in words: its axes, and the lines it draws (in
 * 20 Hz to 20 kHz, above the dB floor), the strongest by Hz and level.
 */
function describeLogSpectrum(state: LabState, lines: SpectralLine[], over: string): string {
  const axes = 'Spectrum, frequency on a log scale from 20 Hz to 20 kHz, level in dB';
  const shown = lines.filter(line => {
    const hz = line.freq * state.carrierHz;
    return hz >= LOG_HZ.min && hz <= LOG_HZ.max && ampDb(line.amp) >= DB_FLOOR;
  });
  if (shown.length === 0) return `${axes}: silent.${over}`;
  const strongest = shown.reduce((a, b) => (Math.abs(b.amp) > Math.abs(a.amp) ? b : a));
  const negative = shown.filter(line => line.amp < 0).length;
  const count = shown.length === 1 ? '1 partial' : `${shown.length} partials`;
  return (
    `${axes}: ${count} above ${DB_FLOOR} dB, the strongest at ` +
    `${(strongest.freq * state.carrierHz).toFixed(0)} Hz, ${ampDb(strongest.amp).toFixed(0)} dB, ` +
    `${negative} with negative phase.${over}`
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
 * view and sound is playing. Never for someone whose device asks for
 * reduced motion.
 */
export function waveformMoves(state: LabState, reducedMotion: boolean): boolean {
  if (reducedMotion || motionView(state) === null) return false;
  return state.playing;
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
  /** When the live view was last drawn, for reduced motion. */
  let lastLive = 0;
  const waveform = document.querySelector<HTMLCanvasElement>('#waveform');
  const note = document.querySelector<HTMLElement>('#waveform-note');
  /** Whether a figure should be following a note that is sounding. */
  const noteMoves = (state: LabState, time: number) =>
    noteHasPlayhead(state, time, motionReduced());
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
        const text = motionNote(state, motionReduced());
        if (note && note.textContent !== text) note.textContent = text;
      },
      // A slow vibrato squeezing and stretching, or a note sounding.
      (state: LabState, time: number) =>
        waveformMoves(state, motionReduced()) || noteMoves(state, time),
    );
  }

  const spectrum = document.querySelector<HTMLCanvasElement>('#spectrum');
  if (spectrum) {
    mountFigure(
      spectrum,
      store,
      (state, canvas, time) => {
        const now = time ?? performance.now() / 1000;
        if (state.compare) {
          // Chapter 9: always the phase-modulated one, whichever is heard.
          drawSpectrum(asPm(state), canvas);
        } else if (time !== undefined && isSounding(state, now)) {
          // While sound plays, what it measures is drawn over the stems.
          // Under reduced motion only a few times a second; each time is a
          // still picture of the sound.
          if (motionReduced() && now - lastLive < CALM_SECONDS) return;
          lastLive = now;
          // Nothing to measure until the audio has started.
          const measured = engine.measure();
          if (measured) drawLiveSpectrum(state, canvas, measured, time);
          else drawSpectrum(state, canvas, time);
        } else {
          drawSpectrum(state, canvas, time);
        }
        // The description is of the patch as set, not of each moment of a
        // note: a screen reader has no use for sixty of them a second.
        // The sandbox's draws nothing while nothing sounds, and says so.
        const sounding = isSounding(state, now);
        const shown = isLogSpectrum(state) && !sounding ? [] : spectrumOf(state);
        const label = describeSpectrum(state, shown, sounding);
        if (canvas.getAttribute('aria-label') !== label) {
          canvas.setAttribute('aria-label', label);
        }
      },
      // A note sounding, or any sound, measured as it plays.
      (state: LabState, time: number) => noteMoves(state, time) || isSounding(state, time),
      // The six operators only as far as they change the sound between
      // notes: spectrumOf keeps its lines while they do not.
      state => [
        ...drawnButOperators(state),
        state.mode === 'ops' && state.voiceModel === 'dx7' ? spectrumOf(state) : state.dxOperators,
      ],
    );
  }

  // Chapter 9's second spectrum: the patch as true frequency modulation.
  const compare = document.querySelector<HTMLCanvasElement>('#compare');
  if (compare) {
    mountFigure(compare, store, (state, canvas) => {
      const fm = asFm(state);
      const lines = drawSpectrum(fm, canvas);
      canvas.setAttribute('aria-label', describeSpectrum(fm, lines));
    });
  }

  // Chapter 8's algorithm, as the DX7 draws it.
  const diagram = document.querySelector<HTMLCanvasElement>('#algorithm-plot');
  if (diagram) {
    // Its boxes light up with each operator's level while a note sounds,
    // except under reduced motion, as the playhead does.
    mountFigure(
      diagram,
      store,
      (state, canvas, time) => {
        drawAlgorithm(state, canvas, time);
        const label = describeAlgorithm(state.algorithm);
        if (canvas.getAttribute('aria-label') !== label) {
          canvas.setAttribute('aria-label', label);
        }
      },
      noteMoves,
      drawnButOperators,
    );
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
