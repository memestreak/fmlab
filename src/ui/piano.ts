import { CARRIER_HZ, type LabStore } from '../model/lab';

// A one-voice keyboard for the sandbox: on screen, and on the computer's
// own keys laid out the way music software does it. Holding a key plays
// the patch at that key's pitch; letting go stops it. One note at a time:
// the design spec leaves polyphony out.

/** MIDI note numbers: 69 is A4, 440 Hz. */
const A4 = 69;

/** A note's frequency in equal temperament, A4 = 440 Hz. */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - A4) / 12);
}

const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** "A4", "C♯3": the note's name and octave, as musicians write it. */
export function noteName(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Whether a note is a black key. */
export function isBlack(midi: number): boolean {
  return NAMES[midi % 12].includes('♯');
}

/**
 * Whether a note is inside the Carrier slider's range, A1 (55 Hz) to A5
 * (880 Hz). Keys outside it are drawn but cannot be played.
 */
export function playable(midi: number): boolean {
  return midiToHz(midi) >= CARRIER_HZ.min - 1e-9 && midiToHz(midi) <= CARRIER_HZ.max + 1e-9;
}

/** The keyboard shows two octaves, starting on a C. */
export const KEYS = 24;
/** The Cs it can start on: C2, C3, C4. */
export const STARTS = [36, 48, 60];
export const FIRST_START = 48;

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
 * Which note should be sounding, given the keys held down in the order
 * they were pressed: the one pressed last. Letting go of it falls back to
 * the one before, as a one-voice synth does.
 */
export function sounding(held: readonly number[]): number | null {
  return held.length === 0 ? null : held[held.length - 1];
}

/**
 * Builds the on-screen keyboard in `container` and listens to the
 * computer's keys while `active()` says the sandbox is showing. Pressing
 * starts the sound at the key's pitch; letting go of every key stops it,
 * unless the sound was already playing from the Play button, in which case
 * it is left playing at the last pitch.
 */
export function mountPiano(
  container: HTMLElement,
  store: LabStore,
  active: () => boolean,
): void {
  let start = FIRST_START;
  const held: number[] = [];
  /** Whether the piano started the sound, and so should stop it. */
  let ownsSound = false;
  const keys = new Map<number, HTMLButtonElement>();

  const board = document.createElement('div');
  board.className = 'piano-keys';
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', 'Piano keyboard');

  const octave = (label: string, direction: number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'piano-octave';
    button.textContent = label;
    button.setAttribute('aria-label', direction < 0 ? 'Octave down (Z)' : 'Octave up (X)');
    button.addEventListener('click', () => move(direction));
    return button;
  };
  const down = octave('−', -1);
  const up = octave('+', 1);

  // The octave control, left of the keys: its name, − and + either side
  // of the range the keys cover, and the computer keys that do the same.
  const range = document.createElement('span');
  range.className = 'piano-oct-range num';
  const control = document.createElement('div');
  control.className = 'piano-oct';
  control.innerHTML =
    '<span class="piano-oct-label" aria-hidden="true">Octave</span>' +
    '<div class="piano-oct-row"></div>' +
    '<span class="piano-oct-hint" aria-hidden="true"><kbd>Z</kbd> <kbd>X</kbd> on the keyboard</span>';
  control.querySelector('.piano-oct-row')?.append(down, range, up);

  const update = () => {
    const note = sounding(held);
    for (const [midi, key] of keys) {
      key.setAttribute('aria-pressed', String(midi === note));
    }
  };

  /** @param struck whether a key was just pressed, not let go of */
  const play = (struck: boolean) => {
    const note = sounding(held);
    if (store.get().noteMode) {
      // Six operators play notes: a key strikes one at its pitch, which
      // dies away by itself as chapter 8's do. Letting go strikes nothing.
      if (struck && note !== null) {
        const { notes } = store.get();
        store.set({ carrierHz: midiToHz(note), notes: notes + 1 });
      }
    } else if (note === null) {
      if (ownsSound) store.set({ playing: false });
      ownsSound = false;
    } else {
      if (!store.get().playing) ownsSound = true;
      // Inside the key press, so the engine may start audio.
      store.set({ carrierHz: midiToHz(note), playing: true });
    }
    update();
  };
  const press = (midi: number) => {
    if (!playable(midi) || held.includes(midi)) return;
    held.push(midi);
    play(true);
  };
  const release = (midi: number) => {
    const at = held.indexOf(midi);
    if (at === -1) return;
    held.splice(at, 1);
    play(false);
  };
  const releaseAll = () => {
    held.length = 0;
    play(false);
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
      if (letter) {
        const mark = document.createElement('span');
        mark.className = 'piano-letter';
        mark.textContent = letter;
        mark.setAttribute('aria-hidden', 'true');
        key.append(mark);
      }
      // Every C names itself, so the octave can be read off the keys.
      if (midi % 12 === 0) {
        key.classList.add('piano-is-c');
        const name = document.createElement('span');
        name.className = 'piano-c num';
        name.textContent = noteName(midi);
        name.setAttribute('aria-hidden', 'true');
        key.append(name);
      }
      // A pointer holds a key for as long as it is down on it.
      key.addEventListener('pointerdown', event => {
        key.setPointerCapture(event.pointerId);
        press(midi);
      });
      key.addEventListener('pointerup', () => release(midi));
      key.addEventListener('pointercancel', () => release(midi));
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

  // The octave control, then the keys.
  container.replaceChildren(control, board);
  draw();

  // The computer's keys, while the sandbox is showing. Not with Ctrl, Alt
  // or Cmd held (those are the browser's), and not while typing.
  document.addEventListener('keydown', event => {
    if (!active() || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest('input[type="text"], textarea, select')) return;
    if (event.code === OCTAVE_DOWN) return move(-1);
    if (event.code === OCTAVE_UP) return move(1);
    const midi = noteForCode(event.code, start);
    if (midi === null) return;
    event.preventDefault();
    press(midi);
  });
  document.addEventListener('keyup', event => {
    const midi = noteForCode(event.code, start);
    if (midi !== null) release(midi);
  });
  // A key let go of in another window would otherwise sound for ever.
  window.addEventListener('blur', releaseAll);
  store.subscribe((state, previous) => {
    if (state.chapter !== previous.chapter) releaseAll();
    // Stopped by Play or space: the piano no longer holds the sound.
    if (!state.playing && previous.playing) {
      ownsSound = false;
      held.length = 0;
      update();
    }
  });
}
