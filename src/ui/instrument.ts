import type { Chapter } from '../chapters/types';
import { DX7_COUNT } from '../dsp/algorithms';
import type { LabStore } from '../model/lab';

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
  { node: '[data-control="feedback"]', to: 'inst-feedback' },
  { node: '.panel-operators', to: 'inst-operators' },
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
