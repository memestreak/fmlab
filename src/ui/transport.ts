import type { AudioEngine } from '../audio/engine';
import { holdPeak, meterPosition, type PeakHold } from '../audio/level';
import type { LabStore } from '../model/lab';

/** How often the meter moves for someone who asked for reduced motion. */
const CALM_METER_MS = 250;
const NO_PEAK: PeakHold = { position: 0, at: 0 };

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
 * The level meter: a bar that follows the engine's output while sound is
 * playing, empty at -60 dB and full at 0 dB, with a marker that holds the
 * recent peak. It is a readout, not a control. It only runs its animation
 * frame loop while playing.
 */
export function mountMeter(
  meter: HTMLElement,
  store: LabStore,
  engine: AudioEngine,
): void {
  const fill = meter.querySelector<HTMLElement>('.meter-fill');
  const marker = meter.querySelector<HTMLElement>('.meter-peak');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let lastShown = 0;
  let peak = NO_PEAK;

  const show = (position: number) => {
    if (fill) fill.style.transform = `scaleX(${position.toFixed(3)})`;
    if (marker) {
      marker.style.left = `${(peak.position * 100).toFixed(1)}%`;
      marker.hidden = peak.position === 0;
    }
    meter.setAttribute('aria-valuenow', String(Math.round(position * 100)));
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (calm.matches && now - lastShown < CALM_METER_MS) return;
    const position = meterPosition(engine.level());
    peak = holdPeak(peak, position, now, now - lastShown);
    lastShown = now;
    show(position);
  };

  store.subscribe((state, previous) => {
    if (state.playing === previous.playing) return;
    cancelAnimationFrame(frame);
    if (state.playing) {
      lastShown = performance.now();
      frame = requestAnimationFrame(tick);
    } else {
      peak = NO_PEAK;
      show(0);
    }
  });
}
