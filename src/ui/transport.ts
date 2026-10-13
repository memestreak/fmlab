import type { LabStore } from '../model/lab';

/** The Play / Stop button. Its label is its state. */
export function mountPlayButton(button: HTMLButtonElement, store: LabStore): void {
  // Inside the click, so the engine may start audio: see createStore.
  button.addEventListener('click', () => {
    store.set({ playing: !store.get().playing });
  });
  store.subscribe((state, previous) => {
    if (state.playing !== previous.playing) {
      button.textContent = state.playing ? 'Stop' : 'Play';
    }
  });
}
