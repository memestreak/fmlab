import { envelopeAt } from '../dsp/envelope';
import { fmSpectrum } from '../dsp/fmSpectrum';
import { envelopeOf, indexAtTime, type LabState, patchOf } from '../model/lab';
import { drawPlayhead, envelopeSpan } from './envelopePlot';
import { beginPlot, drawFrame, type Row, shareToY } from './plot';
import { axisEnd } from './spectrumPlot';
import { secondsTicks } from './ticks';

/** How wide one slice of time is drawn, in CSS pixels. */
const COLUMN_WIDTH = 3;
/** How thick a partial's mark is. */
const MARK_HEIGHT = 3;
/** A partial this far below full strength, in dB, is not drawn at all. */
export const FLOOR_DB = -48;
/** Below this loudness a slice is silent, and skipped. */
const SILENT = 1e-3;

/**
 * How boldly to draw a partial of a given strength (its amplitude times
 * the note's loudness at that moment): 0 at FLOOR_DB or quieter, 1 at
 * full strength, even in dB between, which is roughly how loudness is
 * heard.
 */
export function boldness(strength: number): number {
  if (strength <= 0) return 0;
  const db = 20 * Math.log10(strength);
  return Math.min(1, Math.max(0, 1 - db / FLOOR_DB));
}

/** One slice of the note: its partials, each with how boldly to draw it. */
export interface Slice {
  /** Frequencies in carrier units, with boldness from 0 to 1. */
  marks: { freq: number; boldness: number }[];
}

/**
 * The note `time` seconds in: the line spectrum at the index the envelope
 * gives then, scaled by the loudness it gives then. This is the spectrum
 * of the earlier chapters, one moment at a time. Phase is left out: a
 * spectrogram shows how strong, not which way up.
 */
export function sliceAt(state: LabState, time: number): Slice {
  const loudness = envelopeAt(envelopeOf(state), time);
  if (loudness < SILENT) return { marks: [] };
  const { ratio } = patchOf(state);
  const marks = fmSpectrum(ratio, indexAtTime(state, time))
    .map(line => ({
      freq: line.freq,
      boldness: boldness(Math.abs(line.amp) * loudness),
    }))
    .filter(mark => mark.boldness > 0);
  return { marks };
}

/**
 * Draws a note as a spectrogram: time left to right, on the same axis as
 * the envelope figure; frequency upward, in multiples of the carrier; and
 * a --pen-blue mark for each partial at each moment, bolder where it is
 * stronger. It is worked out from the patch and the envelope, not
 * recorded from the sound, so it is there before the note is played.
 *
 * With a `time` in seconds on the page's clock, an ink line shows how far
 * through the last note that moment is.
 */
export function drawSpectrogram(
  state: LabState,
  canvas: HTMLCanvasElement,
  time?: number,
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token, left, right } = plot;
  const span = envelopeSpan(state);
  // Tall enough for the note at its brightest.
  const maxFreq = axisEnd(patchOf(state).ratio, state.index);
  const x = (seconds: number) => left + (seconds / span) * (right - left);

  const rows: Row[] = [
    { share: 0, label: '0', axis: true },
    { share: 0.5, label: String(maxFreq / 2) },
    { share: 1, label: String(maxFreq) },
  ];
  drawFrame(
    plot,
    secondsTicks(span),
    x,
    'time, in seconds; upward, multiples of the carrier',
    rows,
  );

  ctx.fillStyle = token('--pen-blue');
  const columns = Math.ceil((right - left) / COLUMN_WIDTH);
  for (let column = 0; column < columns; column++) {
    // Each slice is the note at the middle of its column.
    const seconds = ((column + 0.5) / columns) * span;
    const columnX = left + column * COLUMN_WIDTH;
    for (const mark of sliceAt(state, seconds).marks) {
      if (mark.freq > maxFreq) continue;
      ctx.globalAlpha = mark.boldness;
      ctx.fillRect(
        columnX,
        shareToY(plot, mark.freq / maxFreq) - MARK_HEIGHT / 2,
        // A hair over, so neighbouring columns leave no gap between them.
        Math.min(COLUMN_WIDTH + 0.5, right - columnX),
        MARK_HEIGHT,
      );
    }
  }
  ctx.globalAlpha = 1;

  drawPlayhead(plot, state, span, time);
}
