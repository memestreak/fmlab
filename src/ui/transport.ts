import { GLOSSARY } from '../chapters/glossary';
import { LANDING } from '../chapters/landing';
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
 * no meaning, so there it plays and stops.
 */
export function spaceIsFree(target: Element | null): boolean {
  return !target?.closest(
    'button, a, summary, input[type="checkbox"], input[type="text"], textarea, select, [contenteditable="true"]',
  );
}

/** The Play / Stop button, or Play note. Space does the same. */
export function mountPlayButton(button: HTMLButtonElement, store: LabStore): void {
  // Inside the click or key press, so the engine may start audio: see
  // createStore.
  const press = () => store.set(pressPlay(store.get(), now()));
  button.addEventListener('click', press);
  document.addEventListener('keydown', event => {
    if (event.key !== ' ' || event.repeat) return;
    if (!(event.target instanceof Element) || !spaceIsFree(event.target)) return;
    // The glossary has no lab: nothing to play.
    if (store.get().chapter === GLOSSARY) return;
    // Or the page would scroll down a screen as well.
    event.preventDefault();
    press();
  });

  // A note ends by itself: the label goes back to Play when it does.
  let ending: number | undefined;
  const show = (state: LabState) => {
    button.textContent = playLabel(state, now());
    window.clearTimeout(ending);
    if (state.noteMode && noteSounding(state, now())) {
      const left = state.noteStartedAt! + state.noteLength - now();
      ending = window.setTimeout(() => show(store.get()), left * 1000 + 50);
    }
  };
  store.subscribe((state, previous) => {
    if (
      state.playing !== previous.playing ||
      state.noteMode !== previous.noteMode ||
      state.chapter !== previous.chapter ||
      state.noteStartedAt !== previous.noteStartedAt ||
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
