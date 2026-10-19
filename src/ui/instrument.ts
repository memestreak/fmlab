import type { Chapter } from '../chapters/types';
import { DX7_COUNT } from '../dsp/algorithms';
import { DX7_FEEDBACK } from '../dsp/dx7';
import type { LabStore } from '../model/lab';
import { steadyDiagramWidth } from '../viz/algorithmPlot';
import { createKnob } from './knob';

/**
 * Where each of the lab's nodes goes on the instrument page: the id of the
 * container in `#instrument` it is moved into. A container takes its
 * nodes in this order.
 */
export const PLACES: readonly { node: string; to: string }[] = [
  { node: '[data-control="volume"]', to: 'inst-tools' },
  { node: '#algorithm', to: 'inst-algorithm' },
  { node: '#dx7-presets', to: 'inst-dx7-presets' },
  { node: '[data-figure="algorithm"]', to: 'inst-diagram-figure' },
  { node: '[data-figure="spectrum"]', to: 'inst-figures' },
  { node: '#piano', to: 'inst-keys' },
];

/**
 * The sandbox as an instrument page. `place` lays the page out, or with
 * `false` puts everything back in the lab. Each node's place in the lab is
 * held by a comment left where it was, so it goes back exactly there
 * however the others have moved. Everything is synchronous, so the page is
 * laid out before it is shown.
 */
export function mountInstrument(): {
  place: (chapter: Chapter, on: boolean) => void;
} {
  const page = document.querySelector<HTMLElement>('#instrument');
  const homes = new Map<Element, Comment>();

  const place = (chapter: Chapter, on: boolean) => {
    if (page) page.hidden = !on;
    for (const spot of PLACES) {
      const el = document.querySelector(spot.node);
      if (!el) continue;
      if (!on) {
        const home = homes.get(el);
        if (home && el.previousSibling !== home) home.after(el);
        continue;
      }
      if (!homes.has(el)) {
        const home = document.createComment(` home of ${spot.node} `);
        el.before(home);
        homes.set(el, home);
      }
      // In PLACES order: each appended after those before it.
      document.getElementById(spot.to)?.append(el);
    }
    if (!on) return;
    const title = document.querySelector('#inst-title');
    if (title) title.textContent = chapter.title;
    const lede = document.querySelector('#inst-lede');
    if (lede) lede.textContent = chapter.lede ?? '';
  };

  return { place };
}

/**
 * The DX7 algorithm one step from `number` in `direction` (1 or -1),
 * round from 32 to 1 and from 1 to 32.
 */
export function stepAlgorithm(number: number, direction: number): number {
  return ((number - 1 + direction + DX7_COUNT) % DX7_COUNT) + 1;
}

/** The ‹ and › either side of the instrument page's algorithm list. */
export function mountAlgorithmSteps(store: LabStore): void {
  const step = (id: string, direction: number) => {
    document.getElementById(id)?.addEventListener('click', () => {
      store.set({ algorithm: stepAlgorithm(store.get().algorithm, direction) });
    });
  };
  step('inst-alg-prev', -1);
  step('inst-alg-next', 1);
}

/**
 * The sandbox's Feedback, a knob under the algorithm chooser, the pair
 * beside the diagram. The diagram's column is as wide as the widest
 * wiring needs at its box size, so the pair sits just clear of algorithm
 * 32 and never moves as the algorithm changes. Ink on paper, as the
 * DX7's feedback belongs to no one operator's role.
 */
export function mountFeedbackKnob(store: LabStore): void {
  const home = document.getElementById('inst-feedback');
  if (!home) return;
  const knob = createKnob({
    label: 'Feedback',
    name: 'Feedback',
    min: DX7_FEEDBACK.min,
    max: DX7_FEEDBACK.max,
    get: () => store.get().dxFeedback,
    // To the hundredth, the old slider's step.
    set: value => store.set({ dxFeedback: Math.round(value * 100) / 100 }),
    format: value => value.toFixed(2),
  });
  home.replaceChildren(knob.element);
  store.subscribe((state, previous) => {
    if (state.dxFeedback !== previous.dxFeedback) knob.update();
  });

  // The diagram as wide as the widest wiring needs, but leaving room for
  // the chooser and the knob beside it (on a phone, the knob alone).
  const row = document.querySelector<HTMLElement>('.inst-diagram');
  const canvas = document.querySelector<HTMLCanvasElement>('#algorithm-plot');
  const chooser = document.querySelector<HTMLElement>('.inst-alg-step-row');
  if (!row || !canvas || !chooser) return;
  // Where the page is laid out wide (the breakpoint is instrument.css's).
  const wide = window.matchMedia('(min-width: 62rem)');
  const size = () => {
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    // On a wide screen the chooser and the knob stand together beside
    // the diagram (the breakpoint is instrument.css's); on a phone the
    // chooser sits above, and the knob alone is beside it.
    const side = wide.matches
      ? Math.max(chooser.offsetWidth, knob.element.offsetWidth)
      : knob.element.offsetWidth;
    const room = row.clientWidth - side - gap;
    const width = steadyDiagramWidth(canvas.getBoundingClientRect().height, room);
    row.style.setProperty('--diagram-width', `${width.toFixed(1)}px`);
  };
  const watch = new ResizeObserver(size);
  watch.observe(row);
  watch.observe(canvas);
}
