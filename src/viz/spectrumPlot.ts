import type { SpectralLine } from '../dsp/fmSpectrum';

/** Space around the plot area for the axis labels, in CSS pixels. */
const MARGIN = { top: 12, right: 12, bottom: 44, left: 40 };
const STEM_WIDTH = 2;
/** Radius of the hollow marker on a negative stem. */
const MARKER_RADIUS = 4;
const LABEL_SIZE = 12;

export interface SpectrumPlotOptions {
  /** Right-hand end of the frequency axis, in carrier units. */
  maxFreq: number;
}

/**
 * Draws a line spectrum as stems on a frequency axis in carrier units,
 * with amplitude from -1 to 1. A positive line is a --pen-blue stem above
 * the axis; a negative one is --pen-red, below it, and ends in a hollow
 * marker so the phase does not rest on colour alone.
 *
 * Colours and fonts are read from the canvas's CSS variables on every
 * call, so calling it again after a theme change repaints in the new
 * theme. The bitmap is sized to the canvas's CSS box times the device
 * pixel ratio.
 */
export function drawSpectrum(
  canvas: HTMLCanvasElement,
  lines: SpectralLine[],
  { maxFreq }: SpectrumPlotOptions,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const style = getComputedStyle(canvas);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const ink = token('--ink');

  const left = MARGIN.left;
  const right = width - MARGIN.right;
  const top = MARGIN.top;
  const bottom = height - MARGIN.bottom;
  const x = (freq: number) => left + (freq / maxFreq) * (right - left);
  const y = (amp: number) => (top + bottom) / 2 - (amp * (bottom - top)) / 2;
  // Half-pixel centres keep one-pixel lines sharp.
  const crisp = (v: number) => Math.round(v) + 0.5;

  const hLine = (amp: number, colour: string) => {
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(left, crisp(y(amp)));
    ctx.lineTo(right, crisp(y(amp)));
    ctx.stroke();
  };

  // Grid, then the zero axis over it.
  ctx.lineWidth = 1;
  for (const amp of [-1, -0.5, 0.5, 1]) hLine(amp, token('--grid'));
  hLine(0, token('--rule'));

  // Labels: numbers in mono, the axis title in sans, all ink.
  ctx.fillStyle = ink;
  ctx.font = `${LABEL_SIZE}px ${token('--font-mono')}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const amp of [-1, 0, 1]) {
    // A real minus sign, as wide as the digits.
    ctx.fillText(String(amp).replace('-', '−'), left - 8, y(amp));
  }
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  for (let freq = 1; freq <= maxFreq; freq++) {
    ctx.fillText(String(freq), x(freq), bottom + 6);
  }
  ctx.font = `${LABEL_SIZE}px ${token('--font-sans')}`;
  ctx.fillText(
    'frequency, in multiples of the carrier',
    (left + right) / 2,
    bottom + 26,
  );

  // Stems.
  ctx.lineWidth = STEM_WIDTH;
  for (const { freq, amp } of lines) {
    if (freq > maxFreq) continue;
    const negative = amp < 0;
    ctx.strokeStyle = token(negative ? '--pen-red' : '--pen-blue');
    ctx.beginPath();
    ctx.moveTo(x(freq), y(0));
    ctx.lineTo(x(freq), y(amp));
    ctx.stroke();
    if (negative) {
      ctx.fillStyle = token('--paper');
      ctx.beginPath();
      ctx.arc(x(freq), y(amp), MARKER_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }
}
