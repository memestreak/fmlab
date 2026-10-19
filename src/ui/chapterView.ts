import {
  type Chapter,
  chapterById,
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
import type { Preset } from '../chapters';
import type { LabState, LabStore } from '../model/lab';
import { mountInstrument } from './instrument';

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
        state.algorithm !== previous.algorithm ||
        state.dxFeedback !== previous.dxFeedback ||
        state.dxOperators !== previous.dxOperators)
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
 * The rest of the landing view's text: the way to the sandbox, and every
 * section by name, in its group. The first section is the named Next
 * link below, as from any section.
 */
function landingNextHtml(): string {
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
  const instrument = mountInstrument();

  const show = (chapter: Chapter) => {
    const isLanding = chapter.id === LANDING;
    // An instrument page has no text column.
    if (narrative) narrative.innerHTML = chapter.instrument ? '' : narrativeHtml(chapter);
    document.title = isLanding ? 'fmlab' : `${chapter.title} · fmlab`;
    // For the stylesheet: the glossary is one centred column with no lab;
    // the sandbox is an instrument page; the landing view is laid out as a
    // section, so going on to the first one changes what is on the page
    // and not where it is.
    document.body.dataset.view =
      chapter.id === GLOSSARY ? 'glossary' : chapter.instrument ? 'instrument' : 'chapter';
    showLab(chapter);
  };

  /**
   * What the lab shows for a chapter: its sliders, buttons, presets and
   * figures.
   */
  const showLab = (chapter: Chapter) => {
    const six = chapter.patch.mode === 'ops';
    // The instrument page first, so the figures are numbered in the order
    // it shows them. Anywhere else everything goes back into the lab.
    instrument.place(chapter, chapter.instrument === true);
    // The space bar's hint, not where the keyboard's letters stand in for
    // it: the sandbox needs the room.
    const hint = document.querySelector<HTMLElement>('.transport .hint');
    if (hint) hint.hidden = chapter.hasPiano === true;

    for (const row of document.querySelectorAll<HTMLElement>('[data-control]')) {
      const id = row.dataset.control as ControlId;
      row.hidden = !chapter.controls.includes(id);
      // The page's label unless the chapter names the slider its own way.
      const label = row.querySelector('label');
      if (label) {
        label.dataset.label ??= label.textContent ?? '';
        label.textContent = chapter.labels?.[id] ?? label.dataset.label;
      }
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
    // Six operators: the Algorithm and Operators panels, together.
    const sixOps = document.querySelector<HTMLElement>('#six-operators-lab');
    if (sixOps) sixOps.hidden = chapter.patch.mode !== 'ops';
    // Its Operators panel is the simple operators'; a DX7 voice has its
    // own table, on the instrument page only.
    const basicOps = document.querySelector<HTMLElement>('.panel-operators');
    if (basicOps) basicOps.hidden = chapter.patch.voiceModel === 'dx7';
    // Chapter 9 has a switch for what is heard. It draws both spectra
    // predicted, so nothing measured is drawn over them there.
    const hear = document.querySelector<HTMLElement>('#hear-switch');
    if (hear) hear.hidden = !chapter.patch.compare;
    const share = document.querySelector<HTMLElement>('#share');
    if (share) share.hidden = !chapter.sharesSound;
    const follows = document.querySelector<HTMLElement>('#index-follows-toggle');
    // Only where the index has an envelope to follow: chapter 6. The
    // landing view and chapter 8 play notes too, but not that way.
    if (follows) follows.hidden = !chapter.controls.includes('attack');

    // With six operators the DX7 list chooses the wiring. Where there are
    // no steps (the sandbox) it is the only way; chapter 8's steps decide
    // for themselves in ui/steps.ts, which runs after this.
    const dx7 = document.querySelector<HTMLElement>('#dx7-chooser');
    if (dx7) dx7.hidden = !six;
    const basic = document.querySelector<HTMLElement>('#basic-wirings');
    if (basic) basic.hidden = !chapter.steps;

    // The chapter's presets, one button each: with six operators beside
    // the DX7 list, as sounds built on its algorithms, elsewhere above the
    // sliders.
    const above = document.querySelector<HTMLElement>('#presets');
    const beside = document.querySelector<HTMLElement>('#dx7-presets');
    const presets = six ? beside : above;
    const unused = six ? above : beside;
    unused?.replaceChildren();
    if (unused) unused.hidden = true;
    if (presets && chapter.presetMenu) {
      presets.hidden = false;
      presets.replaceChildren(...presetMenu(chapter.presets, store));
    } else if (presets) {
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
      hoverOp: null,
      selectedOp: null,
      pinned: null,
      noteStartedAt: null,
      // The glossary has no lab to stop a sound from.
      ...(chapter.patch.noteMode || chapter.id === GLOSSARY ? { playing: false } : {}),
    });
    // A new chapter starts at its top, and says so to a screen reader.
    // On a wide screen the text scrolls in its own column, so that too.
    window.scrollTo(0, 0);
    if (narrative) narrative.scrollTop = 0;
    const title = chapter.instrument
      ? document.querySelector<HTMLElement>('#inst-title')
      : narrative?.querySelector<HTMLElement>('.chapter-title');
    title?.focus({ preventScroll: true });
    showTermInUrl();
  });

  mountSoundInUrl(store);

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

/** The voice a state is, of `presets`: the one whose sound it is exactly. */
export function presetOf(presets: readonly Preset[], state: LabState): number {
  const sound = (s: Partial<LabState>) =>
    JSON.stringify([s.algorithm, s.dxFeedback, s.dxOperators]);
  const now = sound(state);
  return presets.findIndex(preset => sound(preset.patch) === now);
}

/**
 * The voice `steps` along from `at` in a list of `count`, round from the
 * last to the first and back; from no voice (-1), the first or the last.
 */
export function stepPreset(at: number, steps: number, count: number): number {
  if (at < 0) return steps > 0 ? 0 : count - 1;
  return (((at + steps) % count) + count) % count;
}

/**
 * The sandbox's presets as one dropdown with ‹ › either side, stepping
 * round the voices as the diagram's step round the algorithms, and a
 * line beside it saying what the chosen voice plays without. It shows
 * the voice the sound is, or "Edited" once it has been changed; the steps
 * then go on from the voice last chosen.
 */
function presetMenu(presets: readonly Preset[], store: LabStore): HTMLElement[] {
  const select = document.createElement('select');
  select.className = 'input num preset-menu';
  select.setAttribute('aria-label', 'Start from a DX7 factory voice');
  const edited = document.createElement('option');
  edited.value = '';
  edited.textContent = 'Edited';
  edited.disabled = true;
  select.append(
    edited,
    ...presets.map((preset, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = preset.label;
      return option;
    }),
  );
  const note = document.createElement('span');
  note.className = 'preset-note';
  note.id = 'preset-note';
  select.setAttribute('aria-describedby', note.id);
  /** The voice last chosen, which the steps go on from. */
  let last = -1;
  const choose = (at: number) => {
    const preset = presets[at];
    if (!preset) return;
    last = at;
    store.set(preset.patch);
  };
  const step = (label: string, glyph: string, steps: number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'round-step';
    button.textContent = glyph;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => choose(stepPreset(last, steps, presets.length)));
    return button;
  };
  const show = (state: LabState) => {
    const at = presetOf(presets, state);
    if (at >= 0) last = at;
    select.value = at < 0 ? '' : String(at);
    edited.hidden = at >= 0;
    // Beside it, briefly, what the voice plays without; in full in its
    // title and for a screen reader.
    const preset = at < 0 ? null : presets[at];
    note.textContent = preset ? (preset.note ?? preset.hint) : 'your own, from a factory voice';
    note.title = preset ? preset.hint : note.textContent;
  };
  select.addEventListener('change', () => choose(Number(select.value)));
  const stop = store.subscribe((state, previous) => {
    if (!select.isConnected) return stop();
    if (
      state.dxOperators !== previous.dxOperators ||
      state.algorithm !== previous.algorithm ||
      state.dxFeedback !== previous.dxFeedback
    ) {
      show(state);
    }
  });
  show(store.get());
  return [step('Previous preset', '‹', -1), select, step('Next preset', '›', 1), note];
}
