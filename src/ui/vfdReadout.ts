// A vacuum fluorescent readout: four seven-segment places behind dark
// glass, lit cyan, as a 1980s synthesizer's display. The sandbox's
// operator table shows the ratio and the level on one beside each's
// slider (Jeremy, 2026-10-20). It is read only, and hidden from screen
// readers: the slider beside it says the value.

/** A segment: a to g, as the standard seven-segment names. */
type Segment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

const ALL: readonly Segment[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

/** The segments each character lights; anything else lights none. */
export const SEGMENTS: Readonly<Record<string, readonly Segment[]>> = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'd', 'c'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g'],
  '-': ['g'],
  o: ['c', 'd', 'e', 'g'],
  F: ['a', 'e', 'f', 'g'],
  C: ['a', 'd', 'e', 'f'],
  // MIDI Channel's All: "AL".
  A: ['a', 'b', 'c', 'e', 'f', 'g'],
  L: ['d', 'e', 'f'],
};

/** One place of the display: its character ('' for none) and whether its point is lit. */
export interface VfdCell {
  char: string;
  point: boolean;
}

/**
 * The places a text takes, right-aligned in `places`: each character a
 * place, a decimal point folded into the place before it, blanks padding
 * the left. "off" is written o F F. Wider than the display, the left is
 * cut off (the sandbox's longest are "-72.0" and "61.69").
 */
export function vfdCells(text: string, places = 4): VfdCell[] {
  const cells: VfdCell[] = [];
  for (const raw of text) {
    const char = raw === 'f' ? 'F' : raw === '−' ? '-' : raw;
    if (char === '.') {
      if (cells.length > 0) cells[cells.length - 1].point = true;
      else cells.push({ char: '', point: true });
      continue;
    }
    cells.push({ char, point: false });
  }
  const shown = cells.slice(-places);
  while (shown.length < places) shown.unshift({ char: '', point: false });
  return shown;
}

// The segment font: a 10 × 18 cell at a 12-unit pitch, bars 2.1 thick
// with mitred ends and a 0.35 gap at each, skewed −7°.
const T = 2.1;
const G = 0.35;
const PITCH = 12;

function hseg(x: number, y: number, length: number): string {
  const h = T / 2;
  const x0 = x + G;
  const x1 = x + length - G;
  return `M${x0},${y}L${x0 + h},${y - h}L${x1 - h},${y - h}L${x1},${y}L${x1 - h},${y + h}L${x0 + h},${y + h}Z`;
}

function vseg(x: number, y: number, length: number): string {
  const h = T / 2;
  const y0 = y + G;
  const y1 = y + length - G;
  return `M${x},${y0}L${x + h},${y0 + h}L${x + h},${y1 - h}L${x},${y1}L${x - h},${y1 - h}L${x - h},${y0 + h}Z`;
}

const PATHS: Record<Segment, string> = {
  a: hseg(1, 1, 8),
  b: vseg(9, 1, 8),
  c: vseg(9, 9, 8),
  d: hseg(1, 17, 8),
  e: vseg(1, 9, 8),
  f: vseg(1, 1, 8),
  g: hseg(1, 9, 8),
};

const SVG = 'http://www.w3.org/2000/svg';

export interface VfdSpec {
  /** The value now. */
  get: () => number;
  /** A value as the display writes it: "1.41", "-30.8", "off". */
  format: (value: number) => string;
  /** How many places it has (4). */
  places?: number;
}

/**
 * Builds a readout. The glass and its segments are made once; `update()`
 * lights the ones the value now needs, at once, with no easing.
 */
export function createVfdReadout(spec: VfdSpec): { element: HTMLElement; update: () => void } {
  const places = spec.places ?? 4;
  const element = document.createElement('span');
  element.className = 'op-vfd';
  element.setAttribute('aria-hidden', 'true');

  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${places * PITCH} 18.4`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('focusable', 'false');
  const cells = Array.from({ length: places }, (_, i) => {
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('transform', `translate(${i * PITCH + 1.5} 0.2) skewX(-7)`);
    const segments = {} as Record<Segment, SVGPathElement>;
    for (const name of ALL) {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', PATHS[name]);
      path.setAttribute('class', 'vfd-seg');
      g.append(path);
      segments[name] = path;
    }
    const point = document.createElementNS(SVG, 'circle');
    point.setAttribute('cx', '10.6');
    point.setAttribute('cy', '17');
    point.setAttribute('r', '1');
    point.setAttribute('class', 'vfd-seg');
    g.append(point);
    svg.append(g);
    return { segments, point };
  });
  element.append(svg);

  const update = () => {
    const shown = vfdCells(spec.format(spec.get()), places);
    shown.forEach((cell, i) => {
      const lit = new Set(SEGMENTS[cell.char] ?? []);
      for (const name of ALL) cells[i].segments[name].classList.toggle('is-lit', lit.has(name));
      cells[i].point.classList.toggle('is-lit', cell.point);
    });
  };

  update();
  return { element, update };
}
