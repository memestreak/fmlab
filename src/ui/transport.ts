import type { AudioEngine } from '../audio/engine';
import { meterPosition } from '../audio/level';
import type { LabStore } from '../model/lab';

/** How often the meter moves for someone who asked for reduced motion. */
const CALM_METER_MS = 250;

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

/**
 * The output meter: a bar that follows the engine's level while sound is
 * playing, 0 at -60 dB and full at 0 dB. It only runs its animation frame
 * loop while playing.
 */
export function mountMeter(
  meter: HTMLElement,
  store: LabStore,
  engine: AudioEngine,
): void {
  const fill = meter.querySelector<HTMLElement>('.meter-fill');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let lastShown = 0;

  const show = (position: number) => {
    if (fill) fill.style.transform = `scaleX(${position.toFixed(3)})`;
    meter.setAttribute('aria-valuenow', String(Math.round(position * 100)));
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (calm.matches && now - lastShown < CALM_METER_MS) return;
    lastShown = now;
    show(meterPosition(engine.level()));
  };

  store.subscribe((state, previous) => {
    if (state.playing === previous.playing) return;
    cancelAnimationFrame(frame);
    if (state.playing) frame = requestAnimationFrame(tick);
    else show(0);
  });
}
