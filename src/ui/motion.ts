import { settings } from '../model/settings';

// Whether to hold still: the device asks for reduced motion, or the
// Motion setting is Still (Jeremy, 2026-10-21; app-wide since
// 2026-10-29). Everything that moves asks here.

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Whether the sandbox's settings apply: on its page only. */
export function inSandbox(): boolean {
  return document.body.dataset.view === 'instrument';
}

/** Whether motion is unwelcome now. */
export function motionReduced(): boolean {
  return window.matchMedia(REDUCED_MOTION).matches || settings.get().motion === 'still';
}

/** Calls `then` when the answer may have changed: the device's choice, or the setting. */
export function onMotionChange(then: () => void): void {
  window.matchMedia(REDUCED_MOTION).addEventListener('change', then);
  settings.subscribe((state, previous) => {
    if (state.motion !== previous.motion) then();
  });
}
