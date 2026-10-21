import type { Chapter } from '../chapters/types';
import { DX7_COUNT } from '../dsp/algorithms';
import { DX7_FEEDBACK } from '../dsp/dx7';
import type { LabStore } from '../model/lab';
import { createKnob } from './knob';
import { createVfdReadout } from './vfdReadout';

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

/**
 * The ‹ and › either side of the instrument page's algorithm list, and
 * the list's number shown on a VFD readout, as the operator table's
 * ratio and level are (Jeremy, 2026-10-20). The list lies over the
 * readout, unseen, so a click still opens it and the keys still choose.
 */
export function mountAlgorithmSteps(store: LabStore): void {
  const home = document.getElementById('inst-algorithm');
  if (home) {
    const readout = createVfdReadout({ get: () => store.get().algorithm, format: String, places: 2 });
    readout.element.classList.add('inst-alg-vfd');
    home.prepend(readout.element);
    store.subscribe((state, previous) => {
      if (state.algorithm !== previous.algorithm) readout.update();
    });
    // Chrome counts a click on a list as keyboard focus, so the ring
    // would show on a click too: mark a pointer's focus, and clear the
    // mark at the next key.
    const list = document.getElementById('algorithm');
    list?.addEventListener('pointerdown', () => list.setAttribute('data-pointer', ''));
    list?.addEventListener('keydown', () => list.removeAttribute('data-pointer'));
  }
  // Black push keys in the chooser's bezel (Jeremy, 2026-10-21): they
  // step on the press, as the tabs change; Enter and Space work them
  // through the click, and a pointer's own click (detail 1 or more)
  // follows a press that has already stepped.
  const step = (id: string, direction: number) => {
    const key = document.getElementById(id);
    const go = () => store.set({ algorithm: stepAlgorithm(store.get().algorithm, direction) });
    key?.addEventListener('pointerdown', event => {
      if (event.button === 0) go();
    });
    key?.addEventListener('click', event => {
      if (event.detail === 0) go();
    });
  };
  step('inst-alg-prev', -1);
  step('inst-alg-next', 1);
}

/**
 * The sandbox's Feedback, a knob beside the algorithm chooser under the
 * diagram, its value written on the diagram's glass rather than under it.
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
}
