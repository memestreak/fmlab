// The sandbox's Voice, Operators and Octave labels on black embossing
// tape, as a Dymo label maker strikes them (Jeremy, 2026-10-21): white
// capitals raised on one baseline, each letter with the die's own tiny
// unevenness. The unevenness is fixed per label, from the word itself,
// so a label looks the same every time the page loads.

/** The furthest a letter sits off the baseline, in CSS pixels. */
export const STRIKE_DROP = 0.14;
/** The furthest a letter leans, in degrees. */
export const STRIKE_TILT = 0.23;

/** A 32-bit FNV-1a hash of a string. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number from -1 to 1, the same every time for the same key. */
function unit(key: string): number {
  return (hash(key) / 0xffffffff) * 2 - 1;
}

/**
 * How the die struck letter `i` of `word`: its drop off the baseline (px)
 * and its tilt (degrees), within STRIKE_DROP and STRIKE_TILT.
 */
export function strike(word: string, i: number): { drop: number; tilt: number } {
  return {
    drop: unit(`${word}:${i}:drop`) * STRIKE_DROP,
    tilt: unit(`${word}:${i}:tilt`) * STRIKE_TILT,
  };
}

/**
 * Puts `element`'s word on tape: each letter its own span, struck as
 * `strike` says and hidden from screen readers, and the word once more,
 * unseen, for them (unless the element is hidden from them already).
 */
export function tapeLabel(element: Element | null): void {
  if (!element || element.classList.contains('dymo')) return;
  const word = (element.textContent ?? '').trim();
  const letters = [...word.toUpperCase()].map((letter, i) => {
    const span = document.createElement('span');
    span.className = 'dymo-letter';
    span.textContent = letter;
    const { drop, tilt } = strike(word, i);
    span.style.setProperty('--drop', `${drop.toFixed(3)}px`);
    span.style.setProperty('--tilt', `${tilt.toFixed(3)}deg`);
    return span;
  });
  const shown = document.createElement('span');
  shown.className = 'dymo-face';
  shown.setAttribute('aria-hidden', 'true');
  shown.append(...letters);
  const parts: Node[] = [shown];
  if (element.getAttribute('aria-hidden') !== 'true') {
    const said = document.createElement('span');
    said.className = 'visually-hidden';
    said.textContent = word;
    parts.push(said);
  }
  element.replaceChildren(...parts);
  element.classList.add('dymo');
}
