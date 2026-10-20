// A number reel: a small vertical drum of values, turned rather than
// typed in. The sandbox's operator table uses it for each operator's
// share of the LFO's tremolo, eleven stops from off to 100 %. It is a
// canvas that is a control, as the Bessel plot is: a `role="slider"`,
// turned by a vertical drag (up for more), the mouse wheel (as a page
// scrolls: down for the larger values below), a click above
// or below the middle, or the keys. A value between stops (a factory
// voice's 26 %) is shown as it is, on the drum between its neighbours,
// and a turn goes to the next stop that way.

import { beginPlot } from '../viz/plot';

/** The reel's stops: every tenth from 0 to 1. */
export const REEL_STOPS = 10;
/** Pixels of drag, and of wheel, per step. */
const DRAG_STEP = 14;
const WHEEL_STEP = 30;
/** The angle between neighbouring values on the drum, in radians. */
const SPACING = 0.72;
/** How far towards its value the drum turns each frame. */
const EASE = 0.3;

/**
 * The value `steps` stops from `value` (0 to 1), up for positive. From a
 * value between stops the first step goes to the stop that way.
 */
export function reelStep(value: number, steps: number): number {
  const at = value * REEL_STOPS;
  const on = Math.abs(at - Math.round(at)) < 1e-6;
  let stop: number;
  if (steps === 0) return value;
  if (on) stop = Math.round(at) + steps;
  else stop = steps > 0 ? Math.ceil(at) + steps - 1 : Math.floor(at) + steps + 1;
  return Math.min(REEL_STOPS, Math.max(0, stop)) / REEL_STOPS;
}

/**
 * The places on the drum, in stops: the eleven stops and, for a value
 * between them, that value too, each to a slot of its own.
 */
export function drumPlaces(value: number): number[] {
  const places = Array.from({ length: REEL_STOPS + 1 }, (_, i) => i);
  const at = value * REEL_STOPS;
  if (Math.abs(at - Math.round(at)) > 1e-6) places.splice(Math.ceil(at), 0, at);
  return places;
}

/** Which slot of the drum a place (in stops) is at, between slots for one between places. */
export function slotOf(places: readonly number[], at: number): number {
  if (at <= places[0]) return 0;
  for (let slot = 1; slot < places.length; slot++) {
    if (at <= places[slot]) return slot - 1 + (at - places[slot - 1]) / (places[slot] - places[slot - 1]);
  }
  return places.length - 1;
}

/**
 * How many whole steps `deltaY` pixels of wheel make, as a page scrolls:
 * positive (down) is more, the next value below.
 */
export function wheelSteps(deltaY: number): number {
  return Math.trunc(deltaY / WHEEL_STEP);
}

/** The step a key takes, or null for a key the reel leaves alone (Space is the page's). */
export function reelKey(value: number, key: string): number | null {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return reelStep(value, 1);
    case 'ArrowDown':
    case 'ArrowLeft':
      return reelStep(value, -1);
    case 'PageUp':
      return reelStep(value, 3);
    case 'PageDown':
      return reelStep(value, -3);
    case 'Home':
      return 0;
    case 'End':
      return 1;
    default:
      return null;
  }
}

export interface ReelSpec {
  /** What a screen reader hears it called: "OP4 tremolo share". */
  name: string;
  /** The value now, 0 to 1. */
  get: () => number;
  /** Takes a new value, 0 to 1. */
  set: (value: number) => void;
  /** A value's label on the drum: "off", "30 %". */
  format: (value: number) => string;
  /** What a screen reader hears a value as. */
  say: (value: number) => string;
}

/** Builds a reel. `update()` shows the value now and redraws it. */
export function createReel(spec: ReelSpec): { element: HTMLCanvasElement; update: () => void } {
  const canvas = document.createElement('canvas');
  canvas.className = 'op-reel';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'slider');
  canvas.setAttribute('aria-label', spec.name);
  canvas.setAttribute('aria-valuemin', '0');
  canvas.setAttribute('aria-valuemax', '100');

  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Where the drum is turned to, in stops; it eases towards the value.
  let shown = spec.get() * REEL_STOPS;
  let frame = 0;

  const draw = () => {
    const plot = beginPlot(canvas);
    if (!plot) return;
    const { ctx, token } = plot;
    const { width: w, height: h } = canvas.getBoundingClientRect();
    const mid = h / 2;
    const radius = h / 2 - 1;
    const ink = token('--ink');
    const font = token('--font-mono');

    ctx.fillStyle = token('--paper');
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, w - 1, h - 1, 4);
    ctx.fill();
    ctx.strokeStyle = token('--rule');
    ctx.lineWidth = 1;
    ctx.stroke();

    // The values round the drum, each squashed as it turns away.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(1, 1, w - 2, h - 2, 4);
    ctx.clip();
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // The values on the drum, each in a slot of its own: the stops, and a
    // value between stops between them.
    const places = drumPlaces(spec.get());
    const now = slotOf(places, shown);
    places.forEach((place, slot) => {
      // Larger values below: the drum turns up to bring them in.
      const t = (slot - now) * SPACING;
      if (Math.abs(t) >= Math.PI / 2) return;
      const near = Math.abs(t) < 0.2;
      ctx.save();
      ctx.translate(w / 2 - 4, mid + Math.sin(t) * (radius + 6));
      ctx.scale(1, Math.cos(t));
      ctx.font = `${near ? 500 : 400} ${near ? 13 : 11}px ${font}`;
      ctx.fillText(spec.format(place / REEL_STOPS), 0, 1);
      ctx.restore();
    });
    ctx.restore();

    // Shading at the top and bottom edges, where the drum turns away.
    const sunken = token('--paper-sunken');
    for (const [from, to] of [
      [1, 9],
      [h - 1, h - 9],
    ]) {
      const shade = ctx.createLinearGradient(0, from, 0, to);
      shade.addColorStop(0, sunken);
      shade.addColorStop(1, 'transparent');
      ctx.fillStyle = shade;
      ctx.fillRect(1, Math.min(from, to), w - 2, 8);
    }

    // The grip: five short ticks at the right edge, turning with the drum.
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    for (let k = -2; k <= 2; k++) {
      const t = k * 0.5 - ((now * 0.9) % 0.5);
      const y = Math.round(mid + Math.sin(t) * (radius - 2)) + 0.5;
      ctx.globalAlpha = Math.max(0, Math.cos(t));
      ctx.beginPath();
      ctx.moveTo(w - 7, y);
      ctx.lineTo(w - 3, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  // Eases the drum to the value, a frame at a time; at once if motion is unwelcome.
  const turn = () => {
    const target = spec.get() * REEL_STOPS;
    if (still.matches) {
      shown = target;
      draw();
      return;
    }
    const step = () => {
      shown += (target - shown) * EASE;
      if (Math.abs(target - shown) < 0.01) shown = target;
      draw();
      frame = shown === target ? 0 : requestAnimationFrame(step);
    };
    cancelAnimationFrame(frame);
    step();
  };

  const update = () => {
    const value = spec.get();
    const percent = Math.round(value * 1000) / 10;
    canvas.setAttribute('aria-valuenow', String(percent));
    canvas.setAttribute('aria-valuetext', spec.say(value));
    if (Math.abs(value * REEL_STOPS - shown) > 1e-9) turn();
    else draw();
  };

  const go = (value: number) => {
    if (value !== spec.get()) spec.set(value);
  };

  // A drag: a step per 14 px from where it started, up for more. A press
  // that does not move is a click: above the middle up, below down.
  let drag: { y: number; from: number; moved: boolean } | null = null;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    drag = { y: event.clientY, from: spec.get(), moved: false };
    event.preventDefault();
    canvas.focus();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    const steps = Math.trunc((drag.y - event.clientY) / DRAG_STEP);
    if (!drag.moved && Math.abs(drag.y - event.clientY) < 3) return;
    drag.moved = true;
    go(reelStep(drag.from, steps));
  });
  canvas.addEventListener('pointerup', event => {
    if (drag && !drag.moved) {
      const box = canvas.getBoundingClientRect();
      go(reelStep(spec.get(), event.clientY < box.top + box.height / 2 ? 1 : -1));
    }
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => {
    drag = null;
  });

  // The wheel: a step per 30 px of scrolling, as a page scrolls: down
  // (positive deltaY) brings the larger values below into the window, a
  // step more (Jeremy, 2026-10-20). The page does not scroll while the
  // pointer is over the reel.
  let wheel = 0;
  canvas.addEventListener(
    'wheel',
    event => {
      event.preventDefault();
      wheel += event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const steps = wheelSteps(wheel);
      if (steps !== 0) {
        wheel -= steps * WHEEL_STEP;
        go(reelStep(spec.get(), steps));
      }
    },
    { passive: false },
  );

  canvas.addEventListener('keydown', event => {
    const next = reelKey(spec.get(), event.key);
    if (next === null) return;
    event.preventDefault();
    go(next);
  });

  void document.fonts?.ready.then(draw);
  update();
  return { element: canvas, update };
}
