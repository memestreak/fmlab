import {
  type Chapter,
  chapterByNumber,
  CHAPTERS,
  type ControlId,
  type FigureId,
  FIRST_CHAPTER,
  neighbours,
} from '../chapters';
import { chapterFromHash, hashForChapter } from '../chapters/route';
import type { LabStore } from '../model/lab';

const NUMBERS = CHAPTERS.map(chapter => chapter.number);

/** The chapter the URL asks for, or the first when it asks for none. */
export function chapterInUrl(): Chapter {
  const { hash } = window.location;
  const number = chapterFromHash(hash, NUMBERS, FIRST_CHAPTER);
  // A hash that names no chapter (one not written yet, say) is put right,
  // so the address bar does not claim a chapter the page is not showing.
  if (hash !== '' && hash !== hashForChapter(number)) {
    window.history.replaceState(null, '', hashForChapter(number));
  }
  // chapterFromHash only returns numbers from NUMBERS.
  return chapterByNumber(number) ?? CHAPTERS[0];
}

/** A paragraph of chapter text. A formula brings its own <p>. */
const paragraph = (html: string) =>
  html.trimStart().startsWith('<p') ? html : `<p>${html}</p>`;

function narrativeHtml(chapter: Chapter): string {
  const { previous, next } = neighbours(chapter.number);
  const maths = chapter.maths
    .map(
      panel => `
        <details class="maths">
          <summary>The maths: ${panel.title}</summary>
          ${panel.body.map(paragraph).join('')}
        </details>`,
    )
    .join('');
  const link = (to: Chapter | undefined, rel: 'prev' | 'next') => {
    if (!to) return '<span></span>';
    const text = `${to.number}&ensp;${to.title}`;
    return `<a href="${hashForChapter(to.number)}" rel="${rel}">${
      rel === 'prev' ? `← ${text}` : `${text} →`
    }</a>`;
  };

  return `
    <p class="chapter-kicker">Chapter ${chapter.number}</p>
    <h2 class="chapter-title" tabindex="-1">${chapter.title}</h2>
    ${chapter.body.map(paragraph).join('')}
    ${maths}
    <nav class="chapter-nav" aria-label="Previous and next chapter">
      ${link(previous, 'prev')}
      ${link(next, 'next')}
    </nav>`;
}

function contentsHtml(current: Chapter): string {
  return CHAPTERS.map(chapter => {
    const here = chapter === current ? ' aria-current="page"' : '';
    return (
      `<a href="${hashForChapter(chapter.number)}"${here} ` +
      `aria-label="Chapter ${chapter.number}: ${chapter.title}">` +
      `${chapter.navLabel}</a>`
    );
  }).join('');
}

/**
 * Shows the store's chapter: its text in the narrative pane, its sliders
 * and captions in the lab pane, and the contents list in the masthead.
 * The chapter itself comes from the URL's hash; when the hash changes the
 * chapter's patch goes into the store and everything else follows from
 * that.
 */
export function mountChapters(store: LabStore): void {
  const narrative = document.querySelector<HTMLElement>('#narrative');
  const contents = document.querySelector<HTMLElement>('#contents');

  const show = (chapter: Chapter) => {
    if (narrative) narrative.innerHTML = narrativeHtml(chapter);
    if (contents) contents.innerHTML = contentsHtml(chapter);
    document.title = `${chapter.title} · fmlab`;

    for (const row of document.querySelectorAll<HTMLElement>('[data-control]')) {
      row.hidden = !chapter.controls.includes(row.dataset.control as ControlId);
    }
    const motion = document.querySelector<HTMLElement>('#motion-toggle');
    if (motion) motion.hidden = !chapter.hasMotion;
    // The figures the chapter names, numbered from 1 in the order shown.
    let number = 0;
    for (const figure of document.querySelectorAll<HTMLElement>('[data-figure]')) {
      const id = figure.dataset.figure as FigureId;
      const text = chapter.figures[id];
      figure.hidden = text === undefined;
      if (text === undefined) continue;
      number += 1;
      const slot = figure.querySelector('.figure-number');
      if (slot) slot.textContent = String(number);
      const caption = figure.querySelector(`#${id}-caption`);
      if (caption) caption.textContent = text;
    }
  };

  store.subscribe((state, previous) => {
    if (state.chapter === previous.chapter) return;
    const chapter = chapterByNumber(state.chapter);
    if (chapter) show(chapter);
  });

  window.addEventListener('hashchange', () => {
    const chapter = chapterInUrl();
    // Nothing stays picked out from the chapter before.
    store.set({
      chapter: chapter.number,
      ...chapter.patch,
      hover: null,
      pinned: null,
    });
    // A new chapter starts at its top, and says so to a screen reader.
    window.scrollTo(0, 0);
    narrative
      ?.querySelector<HTMLElement>('.chapter-title')
      ?.focus({ preventScroll: true });
  });

  const first = chapterByNumber(store.get().chapter);
  if (first) show(first);
}
