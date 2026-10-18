import { HINTS } from '../chapters/sandbox';
import type { Chapter } from '../chapters/types';
import { sectionLink, titleOf } from '../chapters/outline';

/** Which of the sandbox's two layouts: two operators, or six. */
export type InstrumentLayout = 'two' | 'six';

/**
 * Where each of the lab's nodes goes on the instrument page, by layout:
 * the id of the container in `#instrument` it is moved into, or nothing,
 * in which case it stays in (or goes back to) its place in the lab. A
 * container takes its nodes in this order.
 */
export const PLACES: readonly {
  node: string;
  two: string | null;
  six: string | null;
}[] = [
  { node: '[data-control="volume"]', two: 'inst-tools', six: 'inst-tools' },
  { node: '#play', two: 'inst-tools', six: 'inst-tools' },
  { node: '#operator-count', two: 'inst-tools', six: 'inst-tools' },
  { node: '#share', two: 'inst-tools', six: 'inst-tools' },
  { node: '[data-control="ratio"]', two: 'inst-ratio', six: null },
  { node: '[data-control="index"]', two: 'inst-index', six: null },
  { node: '[data-control="carrier"]', two: 'inst-carrier', six: null },
  { node: '#presets', two: 'inst-presets', six: null },
  { node: '#algorithm', two: null, six: 'inst-algorithm' },
  { node: '#dx7-presets', two: null, six: 'inst-dx7-presets' },
  { node: '[data-figure="algorithm"]', two: null, six: 'inst-diagram-figure' },
  { node: '[data-control="feedback"]', two: null, six: 'inst-feedback' },
  { node: '.panel-operators', two: null, six: 'inst-operators' },
  { node: '[data-figure="waveform"]', two: 'inst-two-figures', six: null },
  { node: '[data-figure="spectrum"]', two: 'inst-two-figures', six: 'inst-six-figures' },
  { node: '#piano', two: 'inst-keys', six: 'inst-keys' },
];

/**
 * The sandbox as an instrument page. `place` lays the page out for a
 * layout, or puts everything back in the lab for `null`. Each node's place
 * in the lab is held by a comment left where it was, so it goes back
 * exactly there however the others have moved. Everything is synchronous,
 * so the page is laid out before it is shown.
 */
export function mountInstrument(): {
  place: (chapter: Chapter, layout: InstrumentLayout | null) => void;
} {
  const page = document.querySelector<HTMLElement>('#instrument');
  const homes = new Map<Element, Comment>();
  const node = (selector: string) => document.querySelector(selector);

  for (const hint of document.querySelectorAll<HTMLElement>('[data-hint]')) {
    hint.textContent = HINTS[hint.dataset.hint as keyof typeof HINTS] ?? '';
  }
  const previous = document.querySelector<HTMLAnchorElement>('#inst-previous');
  if (previous) {
    // The sandbox is last: Previous, and no Next. By name, as everywhere.
    const link = document.createElement('template');
    link.innerHTML = sectionLink('fm-vs-pm', `Previous: ${titleOf('fm-vs-pm')}`);
    const a = link.content.firstElementChild as HTMLAnchorElement;
    previous.href = a.getAttribute('href') ?? '';
    previous.textContent = a.textContent;
  }

  const goHome = (el: Element) => {
    const home = homes.get(el);
    if (home && el.previousSibling !== home) home.after(el);
  };

  const place = (chapter: Chapter, layout: InstrumentLayout | null) => {
    if (page) page.hidden = layout === null;
    for (const spot of PLACES) {
      const el = node(spot.node);
      if (!el) continue;
      const target = layout === null ? null : spot[layout];
      if (target === null) {
        goHome(el);
        continue;
      }
      if (!homes.has(el)) {
        const home = document.createComment(` home of ${spot.node} `);
        el.before(home);
        homes.set(el, home);
      }
      // In PLACES order: each appended after those before it.
      document.getElementById(target)?.append(el);
    }
    if (layout === null) return;
    const title = document.querySelector('#inst-title');
    if (title) title.textContent = chapter.title;
    const lede = document.querySelector('#inst-lede');
    if (lede) lede.textContent = chapter.lede ?? '';
  };

  return { place };
}
