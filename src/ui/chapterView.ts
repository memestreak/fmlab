import {
  type Chapter,
  chapterByNumber,
  CHAPTERS,
  type ControlId,
  type FigureId,
  landing,
  LANDING,
  neighbours,
} from '../chapters';
import {
  chapterFromHash,
  hashForChapter,
  isStrayHash,
} from '../chapters/route';
import type { LabStore } from '../model/lab';

const NUMBERS = CHAPTERS.map(chapter => chapter.number);
/** More sliders than this and they go in two columns on a wide screen. */
const MANY_SLIDERS = 4;

/**
 * The chapter the URL asks for, or the landing view when it asks for
 * none.
 */
export function chapterInUrl(): Chapter {
  const { hash, pathname, search } = window.location;
  const number = chapterFromHash(hash, NUMBERS, LANDING);
  // A hash that names no chapter is taken out, so the address bar does
  // not claim a chapter the page is not showing.
  if (isStrayHash(hash, NUMBERS)) {
    window.history.replaceState(null, '', pathname + search);
  }
  // chapterFromHash only returns LANDING or a number from NUMBERS.
  return chapterByNumber(number) ?? landing;
}

/** A paragraph of chapter text. A formula brings its own <p>. */
const paragraph = (html: string) =>
  html.trimStart().startsWith('<p') ? html : `<p>${html}</p>`;

function narrativeHtml(chapter: Chapter): string {
  // The landing view is one line: no number, no heading but the wordmark.
  if (chapter.number === LANDING) {
    return `<div class="landing-line">${chapter.body.map(paragraph).join('')}</div>`;
  }
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

/**
 * What the landing view offers once its sound has been heard: the two
 * ways on, and every chapter by name.
 */
function landingNextHtml(): string {
  const first = CHAPTERS[0];
  const last = CHAPTERS[CHAPTERS.length - 1];
  const chapters = CHAPTERS.map(
    chapter =>
      `<li><a href="${hashForChapter(chapter.number)}">` +
      `<span class="num">${chapter.number}</span>` +
      `<span class="landing-title">${chapter.title}</span></a></li>`,
  ).join('');
  return `
    <p class="landing-ways">
      <a class="btn btn-ink" href="${hashForChapter(first.number)}">Start with chapter ${first.number}</a>
      <a class="btn" href="${hashForChapter(last.number)}">Go to the sandbox</a>
    </p>
    <ol class="landing-chapters">${chapters}</ol>`;
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
 * Shows the store's chapter, or the landing view, which the store holds
 * as one: its text in the narrative pane, its sliders
 * and captions in the lab pane, and the contents list in the masthead.
 * The chapter itself comes from the URL's hash; when the hash changes the
 * chapter's patch goes into the store and everything else follows from
 * that.
 */
export function mountChapters(store: LabStore): void {
  const narrative = document.querySelector<HTMLElement>('#narrative');
  const contents = document.querySelector<HTMLElement>('#contents');

  const next = document.querySelector<HTMLElement>('#landing-next');
  if (next) next.innerHTML = landingNextHtml();

  const show = (chapter: Chapter) => {
    const isLanding = chapter.number === LANDING;
    if (narrative) narrative.innerHTML = narrativeHtml(chapter);
    if (contents) contents.innerHTML = contentsHtml(chapter);
    document.title = isLanding ? 'fmlab' : `${chapter.title} · fmlab`;
    // For the stylesheet: the landing view is one centred column.
    document.body.dataset.view = isLanding ? 'landing' : 'chapter';
    // The ways on appear once the landing view's sound has been heard,
    // and stay if it is come back to.
    if (next) next.hidden = !isLanding || store.get().notes === 0;

    for (const row of document.querySelectorAll<HTMLElement>('[data-control]')) {
      row.hidden = !chapter.controls.includes(row.dataset.control as ControlId);
    }
    // For the stylesheet: a chapter with many sliders sets them in two
    // columns where the lab is pinned beside the text, to leave its
    // figures room.
    const lab = document.querySelector<HTMLElement>('.lab');
    if (lab) lab.dataset.manySliders = String(chapter.controls.length > MANY_SLIDERS);
    const motion = document.querySelector<HTMLElement>('#motion-toggle');
    if (motion) motion.hidden = !chapter.hasMotion;
    const follows = document.querySelector<HTMLElement>('#index-follows-toggle');
    // The landing view plays a note too, but teaches nothing about it.
    if (follows) follows.hidden = !chapter.patch.noteMode || isLanding;

    // The chapter's presets, one button each.
    const presets = document.querySelector<HTMLElement>('#presets');
    if (presets) {
      presets.hidden = chapter.presets.length === 0;
      presets.replaceChildren(
        ...chapter.presets.map(preset => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-quiet';
          button.textContent = preset.label;
          button.setAttribute('aria-label', `${preset.label}: ${preset.hint}`);
          button.addEventListener('click', () => store.set(preset.patch));
          return button;
        }),
      );
    }
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
    if (state.chapter !== previous.chapter) {
      const chapter = chapterByNumber(state.chapter);
      if (chapter) show(chapter);
    } else if (state.notes !== previous.notes && state.chapter === LANDING) {
      // The first press on the landing view: now offer the ways on.
      if (next) next.hidden = false;
    }
  });

  window.addEventListener('hashchange', () => {
    const chapter = chapterInUrl();
    // Nothing stays picked out from the chapter before, nor its last
    // note's playhead. A chapter that plays notes has no steady sound to
    // carry on with, so that stops.
    store.set({
      chapter: chapter.number,
      ...chapter.patch,
      hover: null,
      pinned: null,
      noteStartedAt: null,
      ...(chapter.patch.noteMode ? { playing: false } : {}),
    });
    // A new chapter starts at its top, and says so to a screen reader.
    // On a wide screen the text scrolls in its own column, so that too.
    window.scrollTo(0, 0);
    if (narrative) narrative.scrollTop = 0;
    narrative
      ?.querySelector<HTMLElement>('.chapter-title')
      ?.focus({ preventScroll: true });
  });

  const first = chapterByNumber(store.get().chapter);
  if (first) show(first);
}
