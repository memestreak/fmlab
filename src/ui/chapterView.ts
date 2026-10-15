import {
  type Chapter,
  chapterById,
  labViewOf,
  operatorCountPatch,
  CHAPTERS,
  type ControlId,
  type FigureId,
  GLOSSARY,
  landing,
  LANDING,
  neighbours,
} from '../chapters';
import { groupOf, OUTLINE, type SectionId, titleOf } from '../chapters/outline';
import {
  hashFor,
  isStrayHash,
  paramsFromHash,
  soundFromParams,
  soundParams,
  upgradeHash,
  viewFromHash,
} from '../chapters/route';
import {
  glossaryOrder,
  term,
  type Term,
  type TermId,
  TERMS,
  wikiLink,
} from '../chapters/terms';
import type { LabState, LabStore } from '../model/lab';

/** How long the sound must rest before the address is brought up to date. */
const URL_DELAY_MS = 300;

const IDS = CHAPTERS.map(chapter => chapter.id);
/** More sliders than this and they go in two columns on a wide screen. */
const MANY_SLIDERS = 4;

/**
 * The chapter the URL asks for, or the landing view when it asks for
 * none.
 */
export function chapterInUrl(): Chapter {
  const { pathname, search } = window.location;
  // An old link ("#4", "#7?c=…") is rewritten to the address it meant.
  const upgraded = upgradeHash(window.location.hash);
  if (upgraded) window.history.replaceState(null, '', pathname + search + upgraded);
  const { hash } = window.location;
  const id = viewFromHash(hash, IDS, LANDING);
  // A hash that names nothing is taken out, so the address bar does not
  // claim a section the page is not showing.
  if (isStrayHash(hash, IDS)) {
    window.history.replaceState(null, '', pathname + search);
  }
  return chapterById(id) ?? landing;
}

/**
 * What the URL says a chapter should open with: its own patch, and for a
 * chapter that keeps its sound in the URL, the sound the link carries.
 * For any other chapter, parameters in the hash mean nothing, so they are
 * taken out of the address.
 */
export function openingFromUrl(chapter: Chapter): Partial<LabState> {
  const { hash, pathname, search } = window.location;
  const params = paramsFromHash(hash);
  if (!chapter.sharesSound) {
    // The glossary's parameter names an entry, not a sound: it stays.
    if ([...params].length > 0 && chapter.id !== GLOSSARY) {
      window.history.replaceState(null, '', pathname + search + hashFor(chapter.id));
    }
    return chapter.patch;
  }
  return { ...chapter.patch, ...soundFromParams(params) };
}

/**
 * Keeps the address in step with the sound, in a chapter that keeps its
 * sound there, once it has stopped changing for a moment. It replaces the
 * history entry rather than adding one, so Back still goes to the page
 * before, not to every turn of a slider.
 */
function mountSoundInUrl(store: LabStore): void {
  let timer: number | undefined;
  const write = () => {
    const state = store.get();
    const chapter = chapterById(state.chapter);
    if (!chapter?.sharesSound) return;
    const hash = hashFor(chapter.id, soundParams(state));
    if (window.location.hash === hash) return;
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', pathname + search + hash);
  };
  store.subscribe((state, previous) => {
    if (
      state.chapter === previous.chapter &&
      (state.carrierHz !== previous.carrierHz ||
        state.ratio !== previous.ratio ||
        state.index !== previous.index ||
        state.mode !== previous.mode ||
        state.algorithm !== previous.algorithm ||
        state.feedback !== previous.feedback ||
        state.operators !== previous.operators)
    ) {
      window.clearTimeout(timer);
      timer = window.setTimeout(write, URL_DELAY_MS);
    }
  });

  // Copy link: the address as it is now, sound and all.
  const share = document.querySelector<HTMLButtonElement>('#share');
  if (!share) return;
  share.addEventListener('click', () => {
    window.clearTimeout(timer);
    write();
    const link = window.location.href;
    const done = (text: string) => {
      share.textContent = text;
      window.setTimeout(() => {
        share.textContent = 'Copy link';
      }, 2000);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(
        () => done('Copied'),
        () => window.prompt('Copy this link:', link),
      );
    } else {
      window.prompt('Copy this link:', link);
    }
  });
}

/**
 * The two operators of the Two operators group and the sandbox, drawn
 * small as Operators and algorithms draws a wiring: the modulator (2, green) above the carrier (1, blue), a line
 * from one to the other, and the carrier's line down to the output.
 */
const PAIR_DIAGRAM = `
  <figure class="pair-diagram">
    <svg viewBox="0 0 64 84" width="64" height="84" aria-hidden="true">
      <path class="wire" d="M22 30V42M22 66V78" />
      <rect class="pd-mod" x="10" y="6" width="24" height="24" />
      <rect class="pd-car" x="10" y="42" width="24" height="24" />
      <text x="22" y="19">2</text>
      <text x="22" y="55">1</text>
      <text class="pd-out" x="26" y="79">out</text>
    </svg>
    <figcaption>The wiring: 2 modulates 1, and 1 is heard.</figcaption>
  </figure>`;

/** A paragraph of chapter text. A formula brings its own <p>. */
const paragraph = (html: string) =>
  html.trimStart().startsWith('<p') ? html : `<p>${html}</p>`;

/**
 * The glossary: every defined term, alphabetically, each with its
 * definition, its formula if it has one, and the chapter that defines it.
 */
function glossaryHtml(): string {
  const entries = glossaryOrder()
    .map(id => {
      const { name, plain, formula, section, wiki } = term(id) as Term;
      return `
        <div class="glossary-entry" id="term-${id}" tabindex="-1">
          <dt>${name}</dt>
          <dd>
            <p>${plain}</p>
            ${formula ? `<p class="formula">${formula}</p>` : ''}
            <p class="glossary-from">Defined in
              <a href="${hashFor(section)}">${titleOf(section)}</a>${
                wiki ? ` · ${wikiLink(id)}` : ''
              }</p>
          </dd>
        </div>`;
    })
    .join('');
  return `
    <h2 class="chapter-title" tabindex="-1">Glossary</h2>
    <p>Every term this guide defines, in alphabetical order, each with the
       section that introduces it. In the sections a defined term is
       underlined with dots: point at it, or tap it, to see what it means.</p>
    <dl class="glossary">${entries}</dl>`;
}

function narrativeHtml(chapter: Chapter): string {
  if (chapter.id === GLOSSARY) return glossaryHtml();
  // The landing view comes before the first section, and after it in
  // reverse: Previous and Next run through it as through any section.
  const isLanding = chapter.id === LANDING;
  const { previous, next } = isLanding
    ? { previous: undefined, next: CHAPTERS[0] }
    : chapter === CHAPTERS[0]
      ? { previous: landing, next: neighbours(chapter.id).next }
      : neighbours(chapter.id);
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
    return `<a href="${hashFor(to.id)}" rel="${rel}">${
      rel === 'prev' ? `← ${to.title}` : `${to.title} →`
    }</a>`;
  };

  // A chapter built up in steps: a section each, headed by a button that
  // sets its sound (ui/steps.ts marks the one in force).
  const steps = (chapter.steps ?? [])
    .map(
      (step, index) => `
        <section class="step" data-step-section="${index}">
          <h3 class="step-title"><button type="button" class="step-head" data-step="${index}"><span class="num">${index + 1}</span>&ensp;${step.title}</button></h3>
          ${step.body.map(paragraph).join('')}
        </section>`,
    )
    .join('');

  return `
    <p class="chapter-kicker">${isLanding ? INTRODUCTION : groupOf(chapter.id as SectionId)}</p>
    <h2 class="chapter-title" tabindex="-1">${chapter.title}</h2>
    ${chapter.showsPair ? PAIR_DIAGRAM : ''}
    ${chapter.body.map(paragraph).join('')}
    ${isLanding ? landingNextHtml() : ''}
    ${steps}
    ${maths}
    <nav class="chapter-nav" aria-label="Previous and next section">
      ${link(previous, 'prev')}
      ${link(next, 'next')}
    </nav>`;
}

/** The landing view's group, as the kicker above its title. */
const INTRODUCTION = 'Introduction';

/**
 * The rest of the landing view's text: the two ways on, and every section
 * by name, in its group.
 */
function landingNextHtml(): string {
  const first = CHAPTERS[0];
  // The sandbox: the section with the keyboard, wherever it is.
  const play = CHAPTERS.find(chapter => chapter.hasPiano) ?? CHAPTERS[CHAPTERS.length - 1];
  const groups = OUTLINE.map(
    ({ group, sections }) => `
      <li>
        <span class="landing-group">${group}</span>
        <ul>${sections
          .map(({ id, title }) => `<li><a href="${hashFor(id)}">${title}</a></li>`)
          .join('')}</ul>
      </li>`,
  ).join('');
  return `
    <p class="landing-ways">
      <a class="btn btn-ink" href="${hashFor(first.id)}">Start with ${first.title}</a>
      <a class="btn" href="${hashFor(play.id)}">Go to the sandbox</a>
    </p>
    <ol class="landing-chapters">${groups}</ol>`;
}

/**
 * Shows the store's chapter, or the landing view, which the store holds
 * as one: its text in the narrative pane, its sliders
 * and captions in the lab pane. (The contents panel is ui/contents.ts.)
 * The chapter itself comes from the URL's hash; when the hash changes the
 * chapter's patch goes into the store and everything else follows from
 * that.
 */
export function mountChapters(store: LabStore): void {
  const narrative = document.querySelector<HTMLElement>('#narrative');

  const show = (chapter: Chapter) => {
    const isLanding = chapter.id === LANDING;
    if (narrative) narrative.innerHTML = narrativeHtml(chapter);
    document.title = isLanding ? 'fmlab' : `${chapter.title} · fmlab`;
    // For the stylesheet: the glossary is one centred column with no lab;
    // the landing view is laid out as a section, so going on to the first
    // one changes what is on the page and not where it is.
    document.body.dataset.view = chapter.id === GLOSSARY ? 'glossary' : 'chapter';
    showLab(labViewOf(chapter, store.get()));
  };

  /**
   * What the lab shows for a chapter: its sliders, buttons, presets and
   * figures. On its own when the sandbox switches between two and six
   * operators, which changes the lab and not the text.
   */
  const showLab = (chapter: Chapter) => {
    // The sandbox's switch, and the small pair beside its text, which
    // describes two operators only.
    const count = document.querySelector<HTMLElement>('#operator-count');
    if (count) count.hidden = !chapterById(chapter.id)?.sixOperators;
    const six = chapter.patch.mode === 'ops';
    document.querySelector('#two-operators')?.setAttribute('aria-pressed', String(!six));
    document.querySelector('#six-operators')?.setAttribute('aria-pressed', String(six));
    const pair = narrative?.querySelector<HTMLElement>('.pair-diagram');
    if (pair) pair.hidden = six;
    // The space bar's hint, not where the keyboard's letters stand in for
    // it: the sandbox needs the room.
    const hint = document.querySelector<HTMLElement>('.transport .hint');
    if (hint) hint.hidden = chapter.hasPiano === true;

    for (const row of document.querySelectorAll<HTMLElement>('[data-control]')) {
      row.hidden = !chapter.controls.includes(row.dataset.control as ControlId);
    }
    // For the stylesheet: a chapter with many controls (many sliders, or
    // the piano as well) sets its sliders in two columns where the lab is
    // pinned beside the text, to leave its figures room.
    const lab = document.querySelector<HTMLElement>('.lab');
    const many =
      chapter.controls.length > MANY_SLIDERS ||
      chapter.hasPiano === true ||
      chapter.patch.mode === 'ops';
    if (lab) lab.dataset.manySliders = String(many);
    const piano = document.querySelector<HTMLElement>('#piano');
    if (piano) piano.hidden = !chapter.hasPiano;
    const operators = document.querySelector<HTMLElement>('#operators-panel');
    if (operators) operators.hidden = chapter.patch.mode !== 'ops';
    // Chapter 9 has a switch for what is heard, and draws both spectra
    // predicted, so no live view there.
    const hear = document.querySelector<HTMLElement>('#hear-switch');
    if (hear) hear.hidden = !chapter.patch.compare;
    const live = document.querySelector<HTMLElement>('#live-switch');
    if (live) live.hidden = chapter.patch.compare;
    const picker = document.querySelector<HTMLElement>('#algorithm-picker');
    if (picker) picker.hidden = chapter.patch.mode !== 'ops';
    const share = document.querySelector<HTMLElement>('#share');
    if (share) share.hidden = !chapter.sharesSound;
    const motion = document.querySelector<HTMLElement>('#motion-toggle');
    if (motion) motion.hidden = !chapter.hasMotion;
    const follows = document.querySelector<HTMLElement>('#index-follows-toggle');
    // Only where the index has an envelope to follow: chapter 6. The
    // landing view and chapter 8 play notes too, but not that way.
    if (follows) follows.hidden = !chapter.controls.includes('attack');

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
      const caption = figure.querySelector(`[id="${id}-caption"]`);
      if (caption) caption.textContent = text;
    }
  };

  store.subscribe((state, previous) => {
    if (state.chapter !== previous.chapter) {
      const chapter = chapterById(state.chapter);
      if (chapter) show(chapter);
    } else if (state.mode !== previous.mode) {
      const chapter = chapterById(state.chapter);
      if (chapter?.sixOperators) showLab(labViewOf(chapter, state));
    }
  });

  window.addEventListener('hashchange', () => {
    const chapter = chapterInUrl();
    // Nothing stays picked out from the chapter before, nor its last
    // note's playhead. A chapter that plays notes has no steady sound to
    // carry on with, so that stops.
    store.set({
      chapter: chapter.id,
      ...openingFromUrl(chapter),
      hover: null,
      pinned: null,
      noteStartedAt: null,
      // The glossary has no lab to stop a sound from.
      ...(chapter.patch.noteMode || chapter.id === GLOSSARY ? { playing: false } : {}),
    });
    // A new chapter starts at its top, and says so to a screen reader.
    // On a wide screen the text scrolls in its own column, so that too.
    window.scrollTo(0, 0);
    if (narrative) narrative.scrollTop = 0;
    narrative
      ?.querySelector<HTMLElement>('.chapter-title')
      ?.focus({ preventScroll: true });
    showTermInUrl();
  });

  mountSoundInUrl(store);

  // The sandbox's Two operators / Six operators switch.
  const choose = (six: boolean) => () => {
    if ((store.get().mode === 'ops') !== six) store.set(operatorCountPatch(store.get(), six));
  };
  document.querySelector('#two-operators')?.addEventListener('click', choose(false));
  document.querySelector('#six-operators')?.addEventListener('click', choose(true));

  const first = chapterById(store.get().chapter);
  if (first) show(first);
  showTermInUrl();
}

/**
 * In the glossary, the entry the URL names ("#/glossary?t=index"): brought
 * into view, marked and focused, so a term's link lands on its meaning.
 */
function showTermInUrl(): void {
  const { hash } = window.location;
  if (viewFromHash(hash, IDS, LANDING) !== GLOSSARY) return;
  const id = paramsFromHash(hash).get('t');
  for (const entry of document.querySelectorAll('.glossary-entry.is-current')) {
    entry.classList.remove('is-current');
  }
  if (!id || !(id in TERMS)) return;
  const entry = document.getElementById(`term-${id as TermId}`);
  if (!entry) return;
  entry.classList.add('is-current');
  entry.focus({ preventScroll: true });
  entry.scrollIntoView({ block: 'center' });
}
