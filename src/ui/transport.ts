import { GLOSSARY, LANDING } from '../chapters/outline';
import { type LabState, type LabStore, noteSounding } from '../model/lab';

/** The page's clock in seconds, the one notes are timed on. */
const now = () => performance.now() / 1000;

/**
 * What the main button says at `time`: its label is its state. A steady
 * sound is Play or Stop; a chapter that plays notes is Play note, or Stop
 * while one sounds.
 */
export function playLabel(state: LabState, time: number): string {
  if (state.noteMode) {
    if (noteSounding(state, time)) return 'Stop';
    // The landing view plays a note, but "Play" is all it needs to say.
    return state.chapter === LANDING ? 'Play' : 'Play note';
  }
  return state.playing ? 'Stop' : 'Play';
}

/**
 * What pressing the main button, or the space bar, does to a state at
 * `time`. It starts or stops the sound, everywhere. In a chapter that
 * plays notes, that means a note if none is sounding, and stopping the
 * one that is if it is.
 */
export function pressPlay(state: LabState, time: number): Partial<LabState> {
  if (!state.noteMode) return { playing: !state.playing };
  return noteSounding(state, time)
    ? { stops: state.stops + 1, noteStartedAt: null }
    : { notes: state.notes + 1 };
}

/**
 * Whether the space bar may act as the main button when pressed on
 * `target`. Not where space already means something of its own: on a
 * button (it presses it, so the Play button still works), a link, a
 * checkbox (it ticks it), a maths panel's heading (it opens it), or
 * anything typed into. On a slider, the Bessel plot included, space has
 * no meaning, so there it plays and stops. In the sandbox a menu (the
 * algorithm's) leaves it free too, so that picking from one does not take
 * the keys from the keyboard; its arrows still step it.
 */
export function spaceIsFree(target: Element | null, sandbox = false): boolean {
  if (sandbox && target?.closest('select')) return true;
  return !target?.closest(
    'button, a, summary, input[type="checkbox"], input[type="text"], textarea, select, [contenteditable="true"]',
  );
}

/**
 * How long until the Play button's label must change by itself, in ms: a
 * little after the note sounding at `time` ends; null when there is
 * nothing to wait for, or no end yet (a key held: its note's length is
 * Infinity until it is let go). A timer of Infinity ms would fire at once
 * in a browser, again and again (Jeremy, 2026-10-22).
 */
export function labelTimeout(state: LabState, time: number): number | null {
  if (!state.noteMode || !noteSounding(state, time)) return null;
  const left = state.noteStartedAt! + state.noteLength - time;
  return Number.isFinite(left) ? left * 1000 + 50 : null;
}

/** The Play / Stop button, or Play note. Space does the same. */
export function mountPlayButton(button: HTMLButtonElement, store: LabStore): void {
  // Inside the click or key press, so the engine may start audio: see
  // createStore.
  const press = () => store.set(pressPlay(store.get(), now()));
  button.addEventListener('click', press);
  document.addEventListener('keydown', event => {
    if (event.key !== ' ' || event.repeat) return;
    if (!(event.target instanceof Element)) return;
    if (!spaceIsFree(event.target, store.get().chapter === 'sandbox')) return;
    // The glossary has no lab: nothing to play.
    if (store.get().chapter === GLOSSARY) return;
    // Or the page would scroll down a screen as well.
    event.preventDefault();
    press();
  });

  // A note ends by itself: the label goes back to Play when it does. A
  // key held has no end yet; its timer is armed when it is let go.
  let ending: number | undefined;
  const show = (state: LabState) => {
    const label = playLabel(state, now());
    // Only a change is written: each write makes the page recalculate style.
    if (button.textContent !== label) button.textContent = label;
    window.clearTimeout(ending);
    const wait = labelTimeout(state, now());
    if (wait !== null) ending = window.setTimeout(() => show(store.get()), wait);
  };
  store.subscribe((state, previous) => {
    if (
      state.playing !== previous.playing ||
      state.noteMode !== previous.noteMode ||
      state.chapter !== previous.chapter ||
      state.noteStartedAt !== previous.noteStartedAt ||
      state.noteLength !== previous.noteLength ||
      state.notes !== previous.notes
    ) {
      show(state);
    }
  });
  show(store.get());
}

/**
 * The Sliders button, where the lab is pinned small above the text: it
 * shows and hides the presets and sliders. Elsewhere it is not shown and
 * the sliders always are.
 */
export function mountControlsToggle(button: HTMLButtonElement): void {
  const lab = button.closest<HTMLElement>('.lab');
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    if (lab) lab.dataset.sliders = open ? 'open' : 'closed';
  });
}

/** A checkbox that is one true-or-false field of the store. */
function mountCheckbox(
  input: HTMLInputElement,
  store: LabStore,
  field: 'indexFollows',
): void {
  input.checked = store.get()[field];
  input.addEventListener('change', () => {
    store.set({ [field]: input.checked });
  });
  store.subscribe(state => {
    input.checked = state[field];
  });
}

/** "Index follows the envelope": the lesson of the chapter that has it. */
export function mountIndexFollowsToggle(
  input: HTMLInputElement,
  store: LabStore,
): void {
  mountCheckbox(input, store, 'indexFollows');
}
