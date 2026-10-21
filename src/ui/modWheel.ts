import type { LabStore } from '../model/lab';
import { KNOB_SEGMENTS, litSegments } from './knob';

// The sandbox's mod wheel (Jeremy, 2026-10-21): a ribbed rubber drum in a
// slot of the chassis's plastic, a painted line riding up it, and beside
// it a VFD bar lit from the bottom to the amount. As on the DX7 it adds
// the LFO's wheel depths to its vibrato and tremolo (`lfoDepths`). It
// opens at 0 and stays where it is left: no spring, and in neither the
// link nor storage.

/** How far a drag goes from 0 to full, in CSS pixels. */
export const WHEEL_TRAVEL_PX = 100;
/** How much a scroll of 10 px moves it: 1 %. */
const SCROLL_PX_PER_STEP = 10;
/** A line of a wheel's scroll in pixels, for a mouse that counts lines. */
const LINE_PX = 16;

/** Held to 0 to 1, in tenths of a percent. */
function settle(amount: number): number {
  return Math.round(Math.min(1, Math.max(0, amount)) * 1000) / 1000;
}

/** "40 %": the wheel's amount, as its slider says it. */
export function formatWheel(amount: number): string {
  return `${Math.round(amount * 100)} %`;
}

/**
 * The amount after a key, or null if the key does nothing: up and right
 * 1 % more, down and left 1 % less, Page Up and Down 10 %, Home 0, End
 * full.
 */
export function wheelAfterKey(key: string, amount: number): number | null {
  const percent = Math.round(amount * 100);
  const steps: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };
  if (key === 'Home') return 0;
  if (key === 'End') return 1;
  if (!(key in steps)) return null;
  return settle((percent + steps[key]) / 100);
}

/**
 * The amount after a scroll of `deltaY` (in `deltaMode`'s units): as every
 * wheel in the sandbox, scrolling down (positive) is more, 1 % for each
 * 10 px.
 */
export function wheelAfterScroll(deltaY: number, amount: number, deltaMode = 0): number {
  const px = deltaMode === 1 ? deltaY * LINE_PX : deltaMode === 2 ? deltaY * 800 : deltaY;
  return settle(amount + px / SCROLL_PX_PER_STEP / 100);
}

/** The amount a drag reaches, from `from` at its start, `dy` px down since (up is more). */
export function wheelAfterDrag(from: number, dy: number): number {
  return settle(from - dy / WHEEL_TRAVEL_PX);
}

/** Builds the wheel, its slider wired to the store's `modWheel`. */
export function createModWheel(store: LabStore): HTMLElement {
  const wheel = document.createElement('div');
  wheel.className = 'mod-wheel';
  wheel.tabIndex = 0;
  wheel.setAttribute('role', 'slider');
  wheel.setAttribute('aria-label', 'Mod wheel');
  wheel.setAttribute('aria-orientation', 'vertical');
  wheel.setAttribute('aria-valuemin', '0');
  wheel.setAttribute('aria-valuemax', '100');

  const drum = document.createElement('span');
  drum.className = 'mod-wheel-drum';
  const line = document.createElement('span');
  line.className = 'mod-wheel-line';
  drum.append(line);

  // The bar: the knobs' dial segments stood on end, lit from the bottom.
  const bar = document.createElement('span');
  bar.className = 'mod-wheel-bar';
  bar.setAttribute('aria-hidden', 'true');
  const segments = Array.from({ length: KNOB_SEGMENTS }, () => {
    const segment = document.createElement('span');
    segment.className = 'mod-wheel-seg';
    return segment;
  });
  bar.append(...[...segments].reverse());
  wheel.append(drum, bar);

  const amount = () => store.get().modWheel;
  const set = (next: number) => {
    if (next !== amount()) store.set({ modWheel: next });
  };

  const show = () => {
    const now = amount();
    // The line rides from the drum's foot (0) to its top (full), a little
    // fainter towards the ends, where the drum turns away.
    line.style.setProperty('--at', String(now));
    line.style.opacity = String(1 - 0.35 * (2 * now - 1) ** 2);
    const [, lit] = litSegments(now);
    segments.forEach((segment, i) => segment.classList.toggle('is-lit', i < lit));
    wheel.setAttribute('aria-valuenow', String(Math.round(now * 100)));
    wheel.setAttribute('aria-valuetext', formatWheel(now));
  };

  // A drag, up for more, from the press on.
  let drag: { y: number; from: number } | null = null;
  wheel.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    wheel.focus({ preventScroll: true });
    wheel.setPointerCapture(event.pointerId);
    drag = { y: event.clientY, from: amount() };
  });
  wheel.addEventListener('pointermove', event => {
    if (drag) set(wheelAfterDrag(drag.from, event.clientY - drag.y));
  });
  const end = () => {
    drag = null;
  };
  wheel.addEventListener('pointerup', end);
  wheel.addEventListener('pointercancel', end);
  wheel.addEventListener('lostpointercapture', end);
  wheel.addEventListener(
    'wheel',
    event => {
      event.preventDefault();
      set(wheelAfterScroll(event.deltaY, amount(), event.deltaMode));
    },
    { passive: false },
  );
  wheel.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = wheelAfterKey(event.key, amount());
    if (next === null) return;
    event.preventDefault();
    set(next);
  });
  wheel.addEventListener('dblclick', () => set(0));

  store.subscribe((state, previous) => {
    if (state.modWheel !== previous.modWheel) show();
  });
  show();
  return wheel;
}
