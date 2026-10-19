import { ALGORITHMS, algorithm, isDx7, operatorsUsed, targetsOf } from '../dsp/algorithms';
import type { Algorithm } from '../dsp/pmKernel';
import { type LabState, noteSounding, operatorLevelsAt } from '../model/lab';
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
 * Returns the place of each operator (0 to 5), none for an operator the
 * algorithm leaves out, and how many columns and rows the diagram needs.
 */
export function layoutAlgorithm(alg: Algorithm): {
  places: (Place | undefined)[];
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
  return {
    places,
    columns: next,
    rows: Math.max(...places.map(p => p?.row ?? 0)) + 1,
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
  const fb = alg.feedback;
  const loop = !fb
    ? ''
    : fb.from === fb.to
      ? `; ${name(fb.from)} feeds back into itself`
      : `; ${name(fb.from)} feeds back into ${name(fb.to)}`;
  const heard = alg.carriers.length === 1 ? 'carrier' : 'carriers';
  return (
    `${isDx7(number) ? `Algorithm ${number}` : 'Wiring'}: ${heard} ${carriers}` +
    (links ? `; ${links}` : '; no modulation') +
    `${loop}.`
  );
}

/**
 * A box's side, at most; smaller when the canvas is. Large enough that a
 * one- or two-row wiring uses the room the sandbox gives it; the chapter
 * lab's diagram is short, so there the height sets the size.
 */
const BOX = 52;

/**
 * The most columns and the most rows any wiring needs, so every one can
 * be drawn with boxes of the same size.
 */
const LARGEST = ALGORITHMS.map(layoutAlgorithm).reduce(
  (most, { columns, rows }) => ({
    columns: Math.max(most.columns, columns),
    rows: Math.max(most.rows, rows),
  }),
  { columns: 1, rows: 1 },
);

/**
 * The smallest box worth keeping steady: below it, as in the chapter lab's
 * short diagram, each wiring is sized to fit on its own instead.
 */
const STEADY_BOX = 20;

/**
 * The side of a box that fits a wiring of so many columns and rows on a
 * canvas of a size: room for the rows of boxes and the gaps between (1.7
 * boxes a row, less the last gap), the output stub below (0.6) and the
 * feedback loop above (0.35), with the output line's 14 px and a little
 * to spare.
 */
function fitBox(columns: number, rows: number, width: number, height: number): number {
  return Math.min(BOX, (height - 18) / (rows * 1.7 + 0.25), (width - 40) / (columns * 1.6));
}

/**
 * How wide a canvas of `height` must be for the widest wiring (six
 * across) to keep the box size its height gives: `box × 9.6 + 40`, from
 * `fitBox`; no wider than `room`, where the box is then sized by the
 * width instead. Never so narrow that the box would fall under
 * STEADY_BOX.
 */
export function steadyDiagramWidth(height: number, room = Infinity): number {
  const box = Math.max(STEADY_BOX, Math.min(BOX, (height - 18) / (LARGEST.rows * 1.7 + 0.25)));
  const across = (side: number) => side * LARGEST.columns * 1.6 + 40;
  return Math.max(across(STEADY_BOX), Math.min(across(box), room));
}

/**
 * Where everything in the diagram goes on a canvas of a size: the side of
 * a box, the gaps, the output line, and each operator's box. Pure, so the
 * drawing and the pointer agree on where a box is. Where the canvas has
 * the room (the sandbox), the box is sized for the largest wiring, so it
 * stays the same as the algorithm changes, and a smaller wiring is centred.
 */
export function diagramGeometry(alg: Algorithm, width: number, height: number) {
  const { places: maybe, columns, rows } = layoutAlgorithm(alg);
  // Only the operators used have places; the rest are never looked up.
  const places = maybe as Place[];
  const steady = fitBox(LARGEST.columns, LARGEST.rows, width, height);
  const box = steady >= STEADY_BOX ? steady : fitBox(columns, rows, width, height);
  const gapX = box * 0.6;
  const gapY = box * 0.7;
  const diagramWidth = columns * box + (columns - 1) * gapX;
  const left = (width - diagramWidth) / 2;
  // Up by half the height this wiring leaves unused.
  const spare = Math.max(0, height - 18 - box * (rows * 1.7 + 0.25));
  const outY = height - 14 - spare / 2;
  const bottom = outY - box * 0.6;
  const boxX = (p: Place) => left + p.column * (box + gapX);
  const boxY = (p: Place) => bottom - box - p.row * (box + gapY);
  const centreX = (p: Place) => boxX(p) + box / 2;
  return { places, box, gapX, gapY, outY, bottom, boxX, boxY, centreX };
}

/**
 * The operator (0 to 5) whose box is at (x, y) on a canvas of a size,
 * with a few pixels to spare round it; null if none.
 */
export function operatorAt(
  algorithmNumber: number,
  width: number,
  height: number,
  x: number,
  y: number,
): number | null {
  const alg = algorithm(algorithmNumber);
  const { places, box, boxX, boxY } = diagramGeometry(alg, width, height);
  const slack = 4;
  for (const op of operatorsUsed(alg)) {
    const p = places[op];
    if (
      x >= boxX(p) - slack &&
      x <= boxX(p) + box + slack &&
      y >= boxY(p) - slack &&
      y <= boxY(p) + box + slack
    ) {
      return op;
    }
  }
  return null;
}

/**
 * Draws the patch's algorithm as a diagram in the DX7's manner: a box per
 * operator with its number, carriers on the bottom row in --pen-blue,
 * modulators above in --pen-green, ink lines from each modulator down to
 * what it modulates and from the carriers down to the output, and the
 * feedback loop as an ink line out of the top of one box and back into
 * the top of another (or the same). Every carrier is drawn alike, and
 * every modulator, whatever its level. An operator the algorithm leaves
 * out is not drawn. At `time`, while a note sounds, each modulator's box
 * is filled in its colour as strongly as the operator sounds at that
 * moment.
 */
export function drawAlgorithm(
  state: LabState,
  canvas: HTMLCanvasElement,
  time?: number,
): void {
  const plot = beginPlot(canvas);
  if (!plot) return;
  const { ctx, token } = plot;
  const { width, height } = canvas.getBoundingClientRect();
  const alg = algorithm(state.algorithm);
  const used = operatorsUsed(alg);
  const { places, box, gapX, outY, bottom, boxX, boxY, centreX } = diagramGeometry(
    alg,
    width,
    height,
  );

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
  const fb = alg.feedback;
  if (fb) {
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
    // On the same scale for both voices: the DX7's 0 to 2π as 0 to 2.
    const amount = state.voiceModel === 'dx7' ? state.dxFeedback / Math.PI : state.feedback;
    if (amount > 0) {
      ctx.lineWidth = 1.5 + amount * 1.25;
      ctx.stroke();
    }
  }

  // How strongly each operator sounds now, while a note does.
  const now =
    time !== undefined && noteSounding(state, time)
      ? operatorLevelsAt(state, time)
      : undefined;

  // The boxes, over the lines.
  ctx.font = `${Math.round(box * 0.42)}px ${token('--font-mono')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const op of used) {
    const p = places[op];
    const carrier = alg.carriers.includes(op);
    const pen = token(carrier ? '--pen-blue' : '--pen-green');
    ctx.fillStyle = token('--paper');
    ctx.fillRect(boxX(p), boxY(p), box, box);
    // A carrier, which is heard, is a box filled in its pen; a modulator,
    // which is not, an outline. The two read apart without colour too.
    if (carrier) {
      ctx.fillStyle = pen;
      ctx.fillRect(boxX(p), boxY(p), box, box);
    } else if (now && now[op] > 0) {
      // While a note sounds, a modulator fills as strongly as it sounds.
      // (A carrier is filled already, so it does not.)
      ctx.globalAlpha = 0.35 * Math.min(1, now[op]);
      ctx.fillStyle = pen;
      ctx.fillRect(boxX(p), boxY(p), box, box);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pen;
    ctx.lineWidth = carrier ? 3 : 2;
    ctx.strokeRect(boxX(p), boxY(p), box, box);
    // Paper on a carrier's fill.
    ctx.fillStyle = carrier ? token('--paper') : ink;
    ctx.fillText(String(op + 1), centreX(p), boxY(p) + box / 2 + 1);
    // The operator pointed at in the table, or here: ringed in ink.
    if (state.hoverOp === op) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      // Clear of the box by a fraction of it, so it fits a small diagram.
      const ring = Math.max(2, box * 0.18);
      ctx.strokeRect(boxX(p) - ring, boxY(p) - ring, box + 2 * ring, box + 2 * ring);
    }
  }

  ctx.font = `12px ${token('--font-sans')}`;
  ctx.textAlign = 'left';
  // In ink, whatever the last box's number was written in.
  ctx.fillStyle = ink;
  ctx.fillText('out', Math.max(...carrierXs) + 6, outY);
}
