import { midiToHz } from '../dsp/voices';
import { type LabStore, releaseSecondsOf } from '../model/lab';
import { createModWheel } from './modWheel';
import { createVfdReadout } from './vfdReadout';

// The sandbox's keyboard: on screen, and on the computer's own keys laid
// out the way music software does it. Every key held sounds, at its own
// pitch, for as long as it is held; letting go releases it.

export { midiToHz };

/** The page's clock in seconds, the one notes are timed on. */
const now = () => performance.now() / 1000;

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** "A4", "C♯3": the note's name and octave, as musicians write it. */
export function noteName(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Whether a note is a black key. */
export function isBlack(midi: number): boolean {
  return NAMES[midi % 12].includes('♯');
}

/** The keyboard shows two octaves, starting on a C. */
export const KEYS = 24;
/**
 * The Cs it can start on: C1 to C5, so from C1–B2 to C5–B6 (Jeremy,
 * 2026-10-21; it was C2 to C4).
 */
export const STARTS = [24, 36, 48, 60, 72];
/** Where it starts, and where a double click on its range brings it back. */
export const FIRST_START = 48;
/** The lowest and highest keys it can show, C1 and B6. */
export const LOWEST_KEY = STARTS[0];
export const HIGHEST_KEY = STARTS[STARTS.length - 1] + KEYS - 1;

/**
 * Whether a note can be played: every key the keyboard can show. (Keys
 * outside the chapters' Carrier slider, A1 to A5, used to be greyed out,
 * which left the top of C4–B5 dead.)
 */
export function playable(midi: number): boolean {
  return midi >= LOWEST_KEY && midi <= HIGHEST_KEY;
}

/**
 * The computer's keys, by `KeyboardEvent.code` so that they are the same
 * keys whatever the keyboard's layout: the home row is the white notes
 * from C, the row above it the black ones, as on a piano. That covers an
 * octave and a half from the keyboard's first C.
 */
const TYPING: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17,
};

/** The two keys that move the keyboard down and up an octave. */
export const OCTAVE_DOWN = 'KeyZ';
export const OCTAVE_UP = 'KeyX';

/** The note a computer key plays with the keyboard starting at `start`. */
export function noteForCode(code: string, start: number): number | null {
  return code in TYPING ? start + TYPING[code] : null;
}

/** The letter printed on the on-screen key a computer key plays, if any. */
export function letterForNote(midi: number, start: number): string | null {
  const offset = midi - start;
  const code = Object.keys(TYPING).find(key => TYPING[key] === offset);
  if (!code) return null;
  if (code === 'Semicolon') return ';';
  if (code === 'Quote') return "'";
  return code.slice(3);
}

/** The keyboard's start an octave down or up, or where it is at an end. */
export function shiftStart(start: number, octaves: number): number {
  const at = STARTS.indexOf(start);
  return STARTS[Math.min(STARTS.length - 1, Math.max(0, at + octaves))];
}

/**
 * Builds the on-screen keyboard in `container` and listens to the
 * computer's keys while `active()` says the sandbox is showing. A key
 * pressed is added to the store's `held`, and the audio engine strikes it;
 * let go, it is taken out, and the engine releases it. The figures follow
 * the key struck last: its pitch is the carrier's, and its moment the
 * note's.
 */
export function mountPiano(
  container: HTMLElement,
  store: LabStore,
  active: () => boolean,
): void {
  let start = FIRST_START;
  const held: number[] = [];
  /** The key struck last, which the figures follow; null once let go. */
  let last: number | null = null;
  const keys = new Map<number, HTMLButtonElement>();

  const board = document.createElement('div');
  board.className = 'piano-keys';
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', 'Piano keyboard');

  // The octave's keys, black push keys as the algorithm chooser's: they
  // step on the press, Enter and Space through the click (a pointer's own
  // click follows a press that has already stepped).
  const octave = (label: string, direction: number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'piano-octave chooser-key';
    button.textContent = label;
    button.setAttribute('aria-label', direction < 0 ? 'Octave down (Z)' : 'Octave up (X)');
    button.addEventListener('pointerdown', event => {
      if (event.button === 0) move(direction);
    });
    button.addEventListener('click', event => {
      if (event.detail === 0) move(direction);
    });
    return button;
  };
  const down = octave('‹', -1);
  const up = octave('›', 1);

  // The control panel, left of the keys (Jeremy, 2026-10-21): Octave over
  // the octave control, ‹ and › either side of a VFD readout of the
  // keyboard's first C, all in one bezel, as the algorithm chooser; and
  // Mod over the mod wheel. The names on one line, the controls on the
  // line under. The range in words lies over the readout, unseen: its tip
  // and its double click are the readout's. Beside Octave, the computer
  // keys that do the same.
  const range = document.createElement('span');
  range.className = 'piano-oct-range num';
  range.title = 'Double-click: back to C3–B4';
  const readout = createVfdReadout({ get: () => start, format: noteName, places: 2 });
  readout.element.classList.add('piano-oct-vfd');
  const display = document.createElement('span');
  display.className = 'piano-oct-display';
  display.append(readout.element, range);
  const control = document.createElement('div');
  control.className = 'piano-panel';
  control.innerHTML =
    '<span class="piano-oct-head">' +
    '<span class="piano-oct-label" aria-hidden="true">Octave</span>' +
    '<span class="piano-oct-hint" aria-hidden="true" title="Z and X on the keyboard"><kbd>Z</kbd><kbd>X</kbd></span>' +
    '</span>' +
    '<span class="mod-wheel-label" aria-hidden="true">Mod</span>' +
    '<div class="piano-oct-row"></div>';
  const row = control.querySelector('.piano-oct-row');
  row?.classList.add('chooser');
  row?.append(down, display, up);
  control.append(createModWheel(store));

  /** Every key held is drawn down. */
  const update = () => {
    for (const [midi, key] of keys) {
      key.setAttribute('aria-pressed', String(held.includes(midi)));
    }
  };

  const press = (midi: number) => {
    if (!playable(midi) || held.includes(midi)) return;
    held.push(midi);
    last = midi;
    // Inside the key press, so the engine may start audio. Held for as
    // long as the key is: the note's length is not known yet.
    store.set({
      held: [...held],
      carrierHz: midiToHz(midi),
      noteStartedAt: now(),
      noteLength: Infinity,
      noteHold: Infinity,
    });
    update();
  };
  const release = (midi: number) => {
    const at = held.indexOf(midi);
    if (at === -1) return;
    held.splice(at, 1);
    const { noteStartedAt } = store.get();
    if (midi === last && noteStartedAt !== null) {
      // The note the figures follow is let go: now its length is known.
      last = null;
      const hold = Math.max(0, now() - noteStartedAt);
      store.set({
        held: [...held],
        noteHold: hold,
        noteLength: hold + releaseSecondsOf(store.get()),
      });
    } else {
      store.set({ held: [...held] });
    }
    update();
  };
  const releaseAll = () => {
    for (const midi of [...held]) release(midi);
  };

  const draw = () => {
    keys.clear();
    board.replaceChildren();
    for (let midi = start; midi < start + KEYS; midi++) {
      const key = document.createElement('button');
      key.type = 'button';
      key.className = isBlack(midi) ? 'piano-key piano-black' : 'piano-key piano-white';
      key.dataset.midi = String(midi);
      key.disabled = !playable(midi);
      const letter = letterForNote(midi, start);
      key.setAttribute(
        'aria-label',
        letter ? `${noteName(midi)}, key ${letter}` : noteName(midi),
      );
      key.setAttribute('aria-pressed', 'false');
      // The computer key that plays it is in its name, not drawn on it
      // (Jeremy, 2026-10-20).
      // Every C names itself, so the octave can be read off the keys; the
      // other white keys' names are there for the Note names setting (All),
      // shown only then.
      if (midi % 12 === 0) key.classList.add('piano-is-c');
      if (!isBlack(midi)) {
        const name = document.createElement('span');
        name.className = midi % 12 === 0 ? 'piano-c num' : 'piano-c piano-letter num';
        name.textContent = midi % 12 === 0 ? noteName(midi) : NAMES[midi % 12];
        name.setAttribute('aria-hidden', 'true');
        key.append(name);
      }
      // The computer key that plays it, for the Computer keys setting.
      if (letter) {
        const typed = document.createElement('span');
        typed.className = 'piano-typed num';
        typed.textContent = letter;
        typed.setAttribute('aria-hidden', 'true');
        key.append(typed);
      }
      // A pointer holds a key for as long as it is down on it.
      key.addEventListener('pointerdown', event => {
        key.setPointerCapture(event.pointerId);
        press(midi);
      });
      key.addEventListener('pointerup', () => release(midi));
      key.addEventListener('pointercancel', () => release(midi));
      key.addEventListener('lostpointercapture', () => release(midi));
      // From the keyboard, Enter or Space on a focused key holds it too.
      key.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
          event.preventDefault();
          press(midi);
        }
      });
      key.addEventListener('keyup', event => {
        if (event.key === 'Enter' || event.key === ' ') release(midi);
      });
      keys.set(midi, key);
      board.append(key);
    }
    const span = `${noteName(start)} to ${noteName(start + KEYS - 1)}`;
    board.setAttribute('aria-label', `Piano keyboard, ${span}`);
    board.dataset.range = span;
    range.textContent = `${noteName(start)}–${noteName(start + KEYS - 1)}`;
    readout.update();
    down.disabled = start === STARTS[0];
    up.disabled = start === STARTS[STARTS.length - 1];
    update();
  };

  const move = (octaves: number) => {
    const next = shiftStart(start, octaves);
    if (next === start) return;
    releaseAll();
    start = next;
    draw();
  };

  // A double click on the range brings the keyboard back to C3–B4.
  range.addEventListener('dblclick', () => {
    if (start === FIRST_START) return;
    releaseAll();
    start = FIRST_START;
    draw();
  });

  // The control panel, then the keys under their felt.
  const felt = document.createElement('div');
  felt.className = 'piano-bed';
  felt.append(board);
  container.replaceChildren(control, felt);
  draw();

  // The computer's keys, while the sandbox is showing. Not with Ctrl, Alt
  // or Cmd held (those are the browser's), and not while typing. A menu
  // with the focus (a preset just picked, or the algorithm) lets them
  // play too, and does not take them as the start of a name (Jeremy,
  // 2026-10-21); its arrows, Enter and Tab are still its own.
  document.addEventListener('keydown', event => {
    if (!active() || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest('input[type="text"], textarea')) return;
    if (event.code === OCTAVE_DOWN || event.code === OCTAVE_UP) {
      event.preventDefault();
      return move(event.code === OCTAVE_DOWN ? -1 : 1);
    }
    const midi = noteForCode(event.code, start);
    if (midi === null) return;
    event.preventDefault();
    press(midi);
  });
  document.addEventListener('keyup', event => {
    const midi = noteForCode(event.code, start);
    if (midi !== null) release(midi);
  });
  // A key let go of in another window, or with the tab hidden, would
  // otherwise sound for ever.
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
  store.subscribe((state, previous) => {
    if (state.chapter !== previous.chapter) releaseAll();
    // Stopped by the space bar: every voice is silenced, so no key is down.
    if (state.stops !== previous.stops && held.length > 0) {
      held.length = 0;
      last = null;
      store.set({ held: [] });
      update();
    }
  });
}
