// A number reel: a small vertical drum of values, turned rather than
// typed in. The sandbox's operator table uses one for each operator's
// ratio, detune, level and share of the LFO's tremolo, each with its own
// stops. It is a canvas that is a control, as the Bessel plot is: a
// `role="slider"`, turned by a vertical drag (up for more), the mouse
// wheel (as a page scrolls: down for the larger values below), a click
// above or below the middle, or the keys. A value between stops (a
// factory voice's 26 % or ratio 1.41) is shown as it is, on the drum
// between its neighbours, and a turn goes to the next stop that way.

import { beginPlot } from '../viz/plot';
import { motionReduced } from './motion';
import { type Settings, settings } from '../model/settings';

/** Pixels of drag, and of wheel, per step. */
const DRAG_STEP = 14;
const WHEEL_STEP = 30;
/** The angle between neighbouring values on the drum, in radians. */
const SPACING = 0.72;
/** How far towards its value the drum turns each frame. */
const EASE = 0.3;
/** How near a stop a value must be to be on it. */
const ON = 1e-6;

/**
 * Where a value is among the stops (ascending): its index, or between two
 * indices for a value between stops. A value beyond the stops (a ratio
 * of 40 from a link, past the reel's 31) is half a stop past that end.
 */
export function placeOf(stops: readonly number[], value: number): number {
  const last = stops.length - 1;
  if (value < stops[0] - ON) return -0.5;
  if (value > stops[last] + ON) return last + 0.5;
  if (value <= stops[0]) return 0;
  if (value >= stops[last]) return last;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (stops[mid] <= value) lo = mid;
    else hi = mid;
  }
  if (Math.abs(value - stops[lo]) < ON) return lo;
  if (Math.abs(value - stops[hi]) < ON) return hi;
  return lo + (value - stops[lo]) / (stops[hi] - stops[lo]);
}

/**
 * The value `steps` stops from `value`, up for positive, held to the
 * ends. From a value between stops the first step goes to the stop that
 * way.
 */
export function reelStep(stops: readonly number[], value: number, steps: number): number {
  if (steps === 0) return value;
  // Beyond the stops, a turn further out leaves it where it is.
  if ((steps > 0 && value > stops[stops.length - 1]) || (steps < 0 && value < stops[0])) return value;
  const at = placeOf(stops, value);
  const on = Math.abs(at - Math.round(at)) < ON;
  let index: number;
  if (on) index = Math.round(at) + steps;
  else index = steps > 0 ? Math.ceil(at) + steps - 1 : Math.floor(at) + steps + 1;
  return stops[Math.min(stops.length - 1, Math.max(0, index))];
}

/**
 * The places on the drum, as places among the stops: every stop and, for
 * a value between stops, that value's place too, each to a slot of its
 * own.
 */
export function drumPlaces(stops: readonly number[], value: number): number[] {
  const places = stops.map((_, i) => i);
  const at = placeOf(stops, value);
  if (Math.abs(at - Math.round(at)) > ON) places.splice(Math.max(0, Math.ceil(at)), 0, at);
  return places;
}

/** Which slot of the drum a place is at, between slots for one between places. */
export function slotOf(places: readonly number[], at: number): number {
  if (at <= places[0]) return at < places[0] ? at - places[0] : 0;
  for (let slot = 1; slot < places.length; slot++) {
    if (at <= places[slot]) return slot - 1 + (at - places[slot - 1]) / (places[slot] - places[slot - 1]);
  }
  return places.length - 1;
}

/**
 * How many whole steps `deltaY` pixels of wheel make, as a page scrolls:
 * positive (down) is more, the next value below; the other way round with
 * the sandbox's Wheel setting on Reverse.
 */
export function wheelSteps(deltaY: number, direction: Settings['wheel'] = 'page'): number {
  return Math.trunc((direction === 'reverse' ? -deltaY : deltaY) / WHEEL_STEP);
}

/**
 * Where a key turns the reel, or null for a key it leaves alone (Space is
 * the page's): the arrows a step, Page Up and Down `page` steps, Home and
 * End the ends.
 */
export function reelKey(stops: readonly number[], value: number, key: string, page: number): number | null {
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return reelStep(stops, value, 1);
    case 'ArrowDown':
    case 'ArrowLeft':
      return reelStep(stops, value, -1);
    case 'PageUp':
      return reelStep(stops, value, page);
    case 'PageDown':
      return reelStep(stops, value, -page);
    case 'Home':
      return stops[0];
    case 'End':
      return stops[stops.length - 1];
    default:
      return null;
  }
}

export interface ReelSpec {
  /** What a screen reader hears it called: "OP4 tremolo share". */
  name: string;
  /** The values it stops at, ascending. */
  stops: readonly number[];
  /** How many stops Page Up and Page Down move. */
  page: number;
  /** The value now. */
  get: () => number;
  /** Takes a new value. */
  set: (value: number) => void;
  /** A value's label on the drum: "off", "30 %", "1.41". */
  format: (value: number) => string;
  /** What a screen reader hears a value as. */
  say: (value: number) => string;
  /** A value as the slider's aria-valuenow (the value itself unless given). */
  ariaValue?: (value: number) => number;
}

/** Builds a reel. `update()` shows the value now and redraws it. */
export function createReel(spec: ReelSpec): { element: HTMLCanvasElement; update: () => void } {
  const canvas = document.createElement('canvas');
  canvas.className = 'op-reel';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'slider');
  canvas.setAttribute('aria-label', spec.name);
  const { stops } = spec;
  const aria = spec.ariaValue ?? ((value: number) => value);
  canvas.setAttribute('aria-valuemin', String(aria(stops[0])));
  canvas.setAttribute('aria-valuemax', String(aria(stops[stops.length - 1])));

  // Where the drum is turned to, as a place among the stops; it eases
  // towards the value's.
  let shown = placeOf(stops, spec.get());
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
    const value = spec.get();
    const places = drumPlaces(stops, value);
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
      const label = Number.isInteger(place) ? spec.format(stops[place]) : spec.format(value);
      ctx.fillText(label, 0, 1);
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
    const target = placeOf(stops, spec.get());
    if (motionReduced()) {
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
    canvas.setAttribute('aria-valuenow', String(Math.round(aria(value) * 1000) / 1000));
    canvas.setAttribute('aria-valuetext', spec.say(value));
    if (Math.abs(placeOf(stops, value) - shown) > 1e-9) turn();
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
    go(reelStep(stops, drag.from, steps));
  });
  canvas.addEventListener('pointerup', event => {
    if (drag && !drag.moved) {
      const box = canvas.getBoundingClientRect();
      go(reelStep(stops, spec.get(), event.clientY < box.top + box.height / 2 ? 1 : -1));
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
      const direction = settings.get().wheel;
      const steps = wheelSteps(wheel, direction);
      if (steps !== 0) {
        // Keep what is left over, in the scroll's own sense.
        wheel -= (direction === 'reverse' ? -steps : steps) * WHEEL_STEP;
        go(reelStep(stops, spec.get(), steps));
      }
    },
    { passive: false },
  );

  canvas.addEventListener('keydown', event => {
    const next = reelKey(stops, spec.get(), event.key, spec.page);
    if (next === null) return;
    event.preventDefault();
    go(next);
  });

  void document.fonts?.ready.then(draw);
  update();
  return { element: canvas, update };
}
