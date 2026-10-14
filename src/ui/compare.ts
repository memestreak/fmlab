import { asFm, type LabState, type LabStore } from '../model/lab';

/**
 * Chapter 9's switch between hearing phase and frequency modulation, and
 * what keeps the frequency-modulated sound in step with Ratio and Index:
 * the engine plays true FM from `modHz` and `deviationHz`, so those follow
 * the two sliders (`asFm`) for as long as the chapter shows.
 */
export function mountCompare(store: LabStore): void {
  const pm = document.querySelector<HTMLButtonElement>('#hear-pm');
  const fm = document.querySelector<HTMLButtonElement>('#hear-fm');
  pm?.addEventListener('click', () => store.set({ mode: 'pm' }));
  fm?.addEventListener('click', () => store.set({ mode: 'fm' }));

  const show = (state: LabState) => {
    pm?.setAttribute('aria-pressed', String(state.mode === 'pm'));
    fm?.setAttribute('aria-pressed', String(state.mode === 'fm'));
  };
  store.subscribe((state, previous) => {
    show(state);
    if (
      state.compare &&
      (state.ratio !== previous.ratio ||
        state.index !== previous.index ||
        state.carrierHz !== previous.carrierHz)
    ) {
      const { modHz, deviationHz } = asFm(state);
      store.set({ modHz, deviationHz });
    }
  });
  show(store.get());
}
