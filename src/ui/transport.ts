import { LANDING } from '../chapters/landing';
import type { LabState, LabStore } from '../model/lab';

/** What the main button says: its label is its state. */
export function playLabel(state: LabState): string {
  // The landing view plays a note, but "Play" is all it needs to say.
  if (state.chapter === LANDING) return 'Play';
  if (state.noteMode) return 'Play note';
  return state.playing ? 'Stop' : 'Play';
}

/**
 * What pressing the main button, or the space bar, does to a state. A
 * chapter that plays notes gets one more note; any other starts or stops
 * its steady sound.
 */
export function pressPlay(state: LabState): Partial<LabState> {
  return state.noteMode
    ? { notes: state.notes + 1 }
    : { playing: !state.playing };
}

/**
 * Whether the space bar may act as the main button when pressed on
 * `target`. Not where space already means something of its own: on a
 * button, a checkbox, a link, a maths panel's heading, or the Bessel
 * plot's slider.
 */
export function spaceIsFree(target: Element | null): boolean {
  return !target?.closest(
    'button, a, summary, input[type="checkbox"], [role="slider"]',
  );
}

/** The Play / Stop button, or Play note. Space does the same. */
export function mountPlayButton(button: HTMLButtonElement, store: LabStore): void {
  // Inside the click or key press, so the engine may start audio: see
  // createStore.
  const press = () => store.set(pressPlay(store.get()));
  button.addEventListener('click', press);
  document.addEventListener('keydown', event => {
    if (event.key !== ' ' || event.repeat) return;
    if (!(event.target instanceof Element) || !spaceIsFree(event.target)) return;
    // Or the page would scroll down a screen as well.
    event.preventDefault();
    press();
  });

  const show = (state: LabState) => {
    button.textContent = playLabel(state);
  };
  store.subscribe((state, previous) => {
    if (
      state.playing !== previous.playing ||
      state.noteMode !== previous.noteMode ||
      state.chapter !== previous.chapter
    ) {
      show(state);
    }
  });
  show(store.get());
}

/** A checkbox that is one true-or-false field of the store. */
function mountCheckbox(
  input: HTMLInputElement,
  store: LabStore,
  field: 'motion' | 'indexFollows',
): void {
  input.checked = store.get()[field];
  input.addEventListener('change', () => {
    store.set({ [field]: input.checked });
  });
  store.subscribe(state => {
    input.checked = state[field];
  });
}

/** The "Show motion" checkbox: animate the waveform without the sound. */
export function mountMotionToggle(input: HTMLInputElement, store: LabStore): void {
  mountCheckbox(input, store, 'motion');
}

/** "Index follows the envelope": the lesson of the chapter that has it. */
export function mountIndexFollowsToggle(
  input: HTMLInputElement,
  store: LabStore,
): void {
  mountCheckbox(input, store, 'indexFollows');
}
