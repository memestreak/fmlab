import { algorithm, targetsOf } from '../dsp/algorithms';
import type { Algorithm } from '../dsp/pmKernel';
import type { LabState } from '../model/lab';
import { beginPlot } from './plot';

/** Where an operator sits in the diagram: a column, and a row up from the carriers' row 0. */
export interface Place {
  column: number;
  row: number;
}

/**
 * Lays an algorithm out as the DX7 draws it: carriers along the bottom,
 * left to right in operator order, and every modulator above the operator
 * it modulates. Each carrier's stack is laid out before the next carrier,
 * so stacks do not cross; where an operator has more than one modulator,
 * the second and later stand in new columns to the right. An operator that
 * modulates several others stands above the first of them, and a line
 * reaches across to the rest.
 *
 * Returns the place of each operator (0 to 5), and how many columns and
 * rows the diagram needs.
 */
export function layoutAlgorithm(alg: Algorithm): {
  places: Place[];
  columns: number;
  rows: number;
} {
  const places: (Place | undefined)[] = [];
  let next = 0;
  const place = (op: number, column: number, row: number) => {
    if (places[op]) {
      // Already placed, under another target: keep it above both.
      places[op]!.row = Math.max(places[op]!.row, row);
      return;
    }
    places[op] = { column, row };
    [...alg.modulators[op]].sort((a, b) => a - b).forEach((from, i) => {
      place(from, i === 0 ? column : next++, row + 1);
    });
  };
  for (const carrier of [...alg.carriers].sort((a, b) => a - b)) {
    place(carrier, next++, 0);
  }
  // A modulator raised under a second target lifts what sits on it too.
  for (let pass = 0; pass < 6; pass++) {
    alg.modulators.forEach((froms, to) => {
      for (const from of froms) {
        places[from]!.row = Math.max(places[from]!.row, places[to]!.row + 1);
      }
    });
  }
  const done = places as Place[];
  return {
    places: done,
    columns: next,
    rows: Math.max(...done.map(p => p.row)) + 1,
  };
}

/** What the diagram shows, in words, for whoever cannot see it. */
export function describeAlgorithm(number: number): string {
  const alg = algorithm(number);
  const name = (op: number) => `OP${op + 1}`;
  const carriers = alg.carriers.map(name).join(', ');
  const links = alg.modulators
    .flatMap((froms, to) => froms.map(from => `${name(from)} modulates ${name(to)}`))
    .join('; ');
  const fb = alg.feedback!;
  const loop =
    fb.from === fb.to
      ? `${name(fb.from)} feeds back into itself`
      : `${name(fb.from)} feeds back into ${name(fb.to)}`;
  return (
    `Algorithm ${number}: carriers ${carriers}` +
    (links ? `; ${links}` : '; no modulation') +
    `; ${loop}.`
  );
}

/** A box's side, at most; smaller when the canvas is. */
const BOX = 34;

/**
 * Draws the patch's algorithm as a diagram in the DX7's manner: a box per
 * operator with its number, carriers on the bottom row in --pen-blue,
 * modulators above in --pen-green, ink lines from each modulator down to
 * what it modulates and from the carriers down to the output, and the
 * feedback loop as an ink line out of the top of one box and back into
 * the top of another (or the same). A box's level dims it, so a silent
 * operator reads as one.
 */
export function drawAlgorithm(state: LabState, canvas: HTMLCanvasElement): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token } = plot;
  const { width, height } = canvas.getBoundingClientRect();
  const alg = algorithm(state.algorithm);
  const { places, columns, rows } = layoutAlgorithm(alg);

  // Room for the rows of boxes, the output line and the feedback loops.
  const box = Math.min(BOX, (height - 40) / (rows * 1.7), (width - 40) / (columns * 1.6));
  const gapX = box * 0.6;
  const gapY = box * 0.7;
  const diagramWidth = columns * box + (columns - 1) * gapX;
  const left = (width - diagramWidth) / 2;
  const outY = height - 14;
  const bottom = outY - box * 0.6;
  const boxX = (p: Place) => left + p.column * (box + gapX);
  const boxY = (p: Place) => bottom - box - p.row * (box + gapY);
  const centreX = (p: Place) => boxX(p) + box / 2;

  const ink = token('--ink');
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = ink;

  // Modulator to modulated: from the bottom of one to the top of the other.
  const targets = targetsOf(alg);
  targets.forEach((tos, from) => {
    for (const to of tos) {
      ctx.beginPath();
      ctx.moveTo(centreX(places[from]), boxY(places[from]) + box);
      ctx.lineTo(centreX(places[to]), boxY(places[to]));
      ctx.stroke();
    }
  });

  // Carriers down to the output line.
  const carrierXs = alg.carriers.map(op => centreX(places[op]));
  ctx.beginPath();
  for (const op of alg.carriers) {
    ctx.moveTo(centreX(places[op]), bottom);
    ctx.lineTo(centreX(places[op]), outY);
  }
  ctx.moveTo(Math.min(...carrierXs), outY);
  ctx.lineTo(Math.max(...carrierXs), outY);
  ctx.stroke();

  // The feedback loop: up from the source, across, and down into the
  // target's top, to the right of everything it passes.
  const fb = alg.feedback!;
  const from = places[fb.from];
  const to = places[fb.to];
  const loopTop = boxY(to) - box * 0.35;
  const loopRight = Math.max(boxX(from), boxX(to)) + box + gapX * 0.45;
  ctx.beginPath();
  ctx.moveTo(boxX(from) + box, boxY(from) + box / 2);
  ctx.lineTo(loopRight, boxY(from) + box / 2);
  ctx.lineTo(loopRight, loopTop);
  ctx.lineTo(centreX(to), loopTop);
  ctx.lineTo(centreX(to), boxY(to));
  ctx.stroke();
  // Thicker as it feeds back more.
  if (state.feedback > 0) {
    ctx.lineWidth = 1.5 + state.feedback * 1.25;
    ctx.stroke();
  }

  // The boxes, over the lines.
  ctx.font = `${Math.round(box * 0.42)}px ${token('--font-mono')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  places.forEach((p, op) => {
    const carrier = alg.carriers.includes(op);
    const level = state.operators[op]?.level ?? 1;
    ctx.fillStyle = token('--paper');
    ctx.fillRect(boxX(p), boxY(p), box, box);
    ctx.globalAlpha = 0.35 + 0.65 * level;
    ctx.strokeStyle = token(carrier ? '--pen-blue' : '--pen-green');
    ctx.lineWidth = 2.5;
    ctx.strokeRect(boxX(p), boxY(p), box, box);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink;
    ctx.fillText(String(op + 1), centreX(p), boxY(p) + box / 2 + 1);
  });

  ctx.font = `12px ${token('--font-sans')}`;
  ctx.textAlign = 'left';
  ctx.fillText('out', Math.max(...carrierXs) + 6, outY);
}
