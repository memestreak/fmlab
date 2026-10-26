import {
  type Chapter,
  chapterById,
  CHAPTERS,
  type ControlId,
  type FigureId,
  GLOSSARY,
  LANDING,
  sequenceNeighbours,
} from '../chapters';
import { groupOf, OUTLINE, type SectionId, SYNTH, titleOf } from '../chapters/outline';
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
import type { Preset, PresetBank } from '../chapters';
import { applyTheme } from '../model/theme';
import { FACTORY_CREDIT } from '../chapters/dx7Voices';
import { DEFAULTS, type LabState, type LabStore } from '../model/lab';
import { mountInstrument } from './instrument';
import { mountPresetPanel } from './presetPanel';
import { stepPreset } from './presetGrid';
import { glitchScreens, topScreens } from './screenGlitch';

/** How long the sound must rest before the address is brought up to date. */
const URL_DELAY_MS = 300;

/**
 * Whether the sandbox keeps its sound in the address as it changes
 * (Jeremy, 2026-10-23: "Let's not update the URL when the sound changes
 * right now"). Off, the synth's address stays #/: a link with a sound
 * still opens it, and is then put back to #/, so a reload opens
 * the synth as it starts rather than the link's old sound; Copy link
 * still builds a link with the sound. On, the address follows the sound,
 * as before.
 */
export const SOUND_IN_URL = false;

const IDS = CHAPTERS.map(chapter => chapter.id);
/** More sliders than this and they go in two columns on a wide screen. */
const MANY_SLIDERS = 4;

/**
 * The chapter the URL asks for, or the synth when it asks for none.
 */
export function chapterInUrl(): Chapter {
  const { pathname, search } = window.location;
  // An old link ("#4", "#7?c=…") is rewritten to the address it meant.
  const upgraded = upgradeHash(window.location.hash);
  if (upgraded) window.history.replaceState(null, '', pathname + search + upgraded);
  const { hash } = window.location;
  const id = viewFromHash(hash, IDS, SYNTH);
  // A hash that names nothing is taken out, so the address bar does not
  // claim a section the page is not showing.
  if (isStrayHash(hash, IDS)) {
    window.history.replaceState(null, '', pathname + search);
  }
  return chapterById(id) ?? chapterById(SYNTH)!;
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
  const address = addressAfterOpening(chapter, hash);
  if (address !== null) window.history.replaceState(null, '', pathname + search + address);
  if (!chapter.sharesSound) return chapter.patch;
  const sound = soundFromParams(params);
  // Back within the session, and no sound in the link: as it was left.
  if (Object.keys(sound).length === 0 && synthAsLeft) return synthAsLeft.patch;
  // A shared sound, remembered so the name's glass can say so.
  if (Object.keys(sound).length > 0) linkSound = soundParams({ ...DEFAULTS, ...chapter.patch, ...sound } as LabState);
  return { ...chapter.patch, ...sound };
}

/**
 * The synth as it was last left, kept for this visit only (Jeremy,
 * 2026-10-25): its whole patch (the voice and its edits) and the operator
 * and tab selected. A reload starts it fresh; a link's sound wins.
 */
let synthAsLeft: { patch: Partial<LabState>; selectedOp: number; voiceTab: LabState['voiceTab'] } | null = null;

/** Keeps the synth as `state` has it, as it is left. */
function leaveSynth(state: LabState): void {
  const synth = chapterById(SYNTH);
  if (!synth) return;
  const patch: Partial<LabState> = {};
  for (const key of Object.keys(synth.patch) as (keyof LabState)[]) {
    (patch as Record<string, unknown>)[key] = state[key];
  }
  synthAsLeft = { patch, selectedOp: state.selectedOp, voiceTab: state.voiceTab };
}

/** The sound a link opened, as its parameters; null when none did. */
let linkSound: string | null = null;

/**
 * The link to a sandbox sound, built when asked for (Jeremy, 2026-10-25:
 * the address never follows the sound, but a sound can be shared):
 * this page's address with the sound's parameters. It carries the voice
 * (algorithm, feedback, the six operators with their velocity, the LFO
 * and the pitch envelope), not the reverb, the settings, the octave or
 * the volume.
 */
export function soundLink(state: LabState, { origin, pathname, search }: Pick<Location, 'origin' | 'pathname' | 'search'>): string {
  return origin + pathname + search + hashFor('sandbox', soundParams(state));
}

/**
 * What the preset name's glass shows for `state`: the preset's name when
 * the sound is one exactly; SHARED for the sound a link opened, until it
 * is changed; otherwise a dimmer EDITED.
 */
export function nameOnGlass(
  presets: readonly Preset[],
  state: LabState,
  opened: string | null,
): { text: string; edited: boolean; preset: number } {
  const at = presetOf(presets, state);
  if (at >= 0) return { text: presets[at].label, edited: false, preset: at };
  if (opened !== null && soundParams(state) === opened) return { text: 'Shared', edited: false, preset: -1 };
  return { text: 'Edited', edited: true, preset: -1 };
}

/**
 * The hash the address is put back to once `chapter` has opened from
 * `hash`, or null to leave it: parameters mean nothing to a chapter
 * that keeps no sound (the glossary's names an entry, and stays), and
 * with SOUND_IN_URL off the sandbox's sound, read, leaves the address.
 */
export function addressAfterOpening(chapter: Chapter, hash: string, soundInUrl = SOUND_IN_URL): string | null {
  const params = paramsFromHash(hash);
  if ([...params].length === 0 || chapter.id === GLOSSARY) return null;
  if (chapter.sharesSound && soundInUrl) return null;
  return hashFor(chapter.id);
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
      SOUND_IN_URL &&
      state.chapter === previous.chapter &&
      // Not the pitch: every note played sets it.
      (state.algorithm !== previous.algorithm ||
        state.dxFeedback !== previous.dxFeedback ||
        state.dxOperators !== previous.dxOperators ||
        state.dxLfo !== previous.dxLfo ||
        state.dxPitchEnvelope !== previous.dxPitchEnvelope)
    ) {
      window.clearTimeout(timer);
      timer = window.setTimeout(write, URL_DELAY_MS);
    }
  });

  // Copy link: the address with the sound as it is now, built on demand
  // (with SOUND_IN_URL off the address bar does not have it).
  const share = document.querySelector<HTMLButtonElement>('#share');
  if (!share) return;
  share.addEventListener('click', () => {
    window.clearTimeout(timer);
    if (SOUND_IN_URL) write();
    const state = store.get();
    const chapter = chapterById(state.chapter);
    const link = chapter?.sharesSound ? soundLink(state, window.location) : window.location.href;
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
  const { previous, next } = sequenceNeighbours(chapter.id);
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
    // An instrument page has no text column.
    if (narrative) narrative.innerHTML = chapter.instrument ? '' : narrativeHtml(chapter);
    // The synth is the site's front page.
    document.title = chapter.id === SYNTH ? 'fmlab' : `${chapter.title} · fmlab`;
    // For the stylesheet: the glossary is one centred column with no lab;
    // the sandbox is an instrument page; the landing view is laid out as a
    // section, so going on to the first one changes what is on the page
    // and not where it is.
    document.body.dataset.view =
      chapter.id === GLOSSARY ? 'glossary' : chapter.instrument ? 'instrument' : 'chapter';
    // The sandbox is dark only; the chapters have the saved choice back.
    // Before anything redraws for the new page.
    applyTheme(store.get().theme, chapter.instrument === true);
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
      presets.replaceChildren(...presetMenu(chapter.presets, chapter.presetBanks ?? [], store));
    } else if (presets) {
      presets.hidden = chapter.presets.length === 0;
      presets.replaceChildren(
        ...chapter.presets.map(preset => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-quiet';
          button.textContent = preset.label;
          button.setAttribute('aria-label', `${preset.label}: ${preset.hint}`);
          // A new voice, not an edit: notes already sounding keep theirs.
          button.addEventListener('click', () => store.set({ ...preset.patch, voiceLoads: store.get().voiceLoads + 1 }));
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
    const before = store.get();
    if (before.chapter === SYNTH) leaveSynth(before);
    const chapter = chapterInUrl();
    const opening = openingFromUrl(chapter);
    // The synth comes back as it was left, unless a link brings a sound.
    const restored = chapter.id === SYNTH && synthAsLeft && opening === synthAsLeft.patch ? synthAsLeft : null;
    // Nothing stays picked out from the chapter before, nor its last
    // note's playhead. A chapter that plays notes has no steady sound to
    // carry on with, so that stops.
    store.set({
      chapter: chapter.id,
      ...opening,
      // A link's sound is a new voice, not an edit.
      voiceLoads: store.get().voiceLoads + 1,
      hover: null,
      hoverOp: null,
      // The synth opens on OP1 selected, its envelope showing, unless it
      // comes back as it was left.
      selectedOp: restored?.selectedOp ?? 0,
      voiceTab: restored?.voiceTab ?? 'envelope',
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
  if (viewFromHash(hash, IDS, SYNTH) !== GLOSSARY) return;
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
    JSON.stringify([s.algorithm, s.dxFeedback, s.dxOperators, s.dxLfo, s.dxPitchEnvelope]);
  const now = sound(state);
  return presets.findIndex(preset => sound(preset.patch) === now);
}

export { FACTORY_CREDIT };

/**
 * The preset's up and down keys, right of its name, in order: ˄ (‹
 * turned a quarter) on to the next voice, ˅ back to the one before
 * (Jeremy, 2026-10-23: the other way was "wired in reverse").
 */
export const PRESET_STEP_KEYS = [
  { label: 'Next preset', glyph: '‹', steps: 1 },
  { label: 'Previous preset', glyph: '›', steps: -1 },
] as const;

/** The arrow keys on the name and those keys: up on and down back, as they go; right on and left back. */
export const PRESET_ARROW_STEPS: Readonly<Record<string, number>> = {
  ArrowUp: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
  ArrowRight: 1,
};

/** The synth's voice last chosen, for this visit; null until one is. */
let lastChosen: number | null = null;

/**
 * The sandbox's presets: the voice's name on VFD glass, a button opening
 * the preset window (ui/presetPanel.ts), where the bank keys are (Jeremy,
 * 2026-10-22), with ‹ › right of it stepping through all the voices, both
 * banks, as the diagram's step round the algorithms. It shows the voice
 * the sound is, or "Edited" once it has been changed; the steps then go
 * on from the voice last chosen.
 */
function presetMenu(presets: readonly Preset[], banks: readonly PresetBank[], store: LabStore): HTMLElement[] {
  const note = document.createElement('span');
  note.className = 'preset-note';
  note.id = 'preset-note';

  /**
   * The voice last chosen, which the steps go on from; kept as the synth
   * is left, for when it comes back.
   */
  let last = lastChosen ?? banks[0]?.start ?? -1;
  const choose = (at: number, glitch: readonly HTMLElement[] = []) => {
    const preset = presets[at];
    if (!preset) return;
    last = at;
    lastChosen = at;
    // A new voice, not an edit: notes already sounding keep theirs.
    store.set({ ...preset.patch, voiceLoads: store.get().voiceLoads + 1 });
    // Both top screens glitch together as the voice changes, each its own
    // kind, and with them the preset window's glass as it turns to the
    // other bank.
    glitchScreens([...topScreens(), ...glitch]);
  };

  // The arrows step through all the voices from the name and its up and
  // down keys (Jeremy, 2026-10-22: across the banks, A32 on to B1, round
  // both ends), as the keys do.
  const arrowSteps = (event: KeyboardEvent) => {
    const steps = PRESET_ARROW_STEPS[event.key];
    if (steps === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    choose(stepPreset(last, steps, presets.length));
  };

  // ‹ ›, turned to point up and down: the algorithm and octave choosers'
  // black push keys, side by side in one bezel right of the name (Jeremy,
  // 2026-10-21). They step on
  // the press, Enter and Space through the click (a pointer's own click
  // follows a press that has already stepped), and never stop: they go
  // round.
  const step = (label: string, glyph: string, steps: number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chooser-key';
    button.textContent = glyph;
    button.setAttribute('aria-label', label);
    const go = () => choose(stepPreset(last, steps, presets.length));
    button.addEventListener('pointerdown', event => {
      if (event.button === 0) go();
    });
    button.addEventListener('click', event => {
      if (event.detail === 0) go();
    });
    button.addEventListener('keydown', arrowSteps);
    return button;
  };

  // The voice's name on VFD glass (Jeremy, 2026-10-21), its ▾ the sign
  // that it opens something: a button opening the preset window.
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'preset-pick';
  pick.setAttribute('aria-haspopup', 'dialog');
  pick.setAttribute('aria-controls', 'preset-panel');
  pick.setAttribute('aria-expanded', 'false');
  pick.setAttribute('aria-describedby', note.id);
  const name = document.createElement('span');
  name.className = 'preset-name';
  name.setAttribute('aria-hidden', 'true');
  pick.append(name);

  const panel = mountPresetPanel({
    presets,
    banks,
    playing: () => presetOf(presets, store.get()),
    last: () => last,
    choose,
    opener: pick,
  });
  const toggle = () => (panel.isOpen() ? panel.shut : panel.open)();
  pick.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    // Not the press's own focusing, which would take focus from the window.
    event.preventDefault();
    toggle();
  });
  pick.addEventListener('click', event => {
    if (event.detail === 0) toggle();
  });
  pick.addEventListener('keydown', arrowSteps);

  const show = (state: LabState) => {
    const at = presetOf(presets, state);
    if (at >= 0) last = at;
    // What the voice plays without, for a screen reader and in the tip.
    const preset = at < 0 ? null : presets[at];
    note.textContent = preset ? (preset.note ?? preset.hint) : 'your own, from a preset voice';
    note.title = preset ? preset.hint : note.textContent;
    // The name's tip: whose the voices are, then, for Yamaha's, what this
    // one plays without; fmlab's own say only whose they are.
    const bank = banks.find(b => b.id === presets[at >= 0 ? at : last]?.bank);
    pick.title = bank && bank.id !== banks[0]?.id ? bank.name : `${FACTORY_CREDIT} · ${note.textContent}`;
    // On the glass: the voice, SHARED for a link's sound, or a dimmer
    // EDITED once the sound is changed.
    const glass = nameOnGlass(presets, state, linkSound);
    name.textContent = glass.text;
    name.classList.toggle('is-edited', glass.edited);
    pick.setAttribute('aria-label', `Preset: ${name.textContent}`);
    panel.show();
  };
  const stop = store.subscribe((state, previous) => {
    if (!pick.isConnected) return stop();
    if (
      state.dxOperators !== previous.dxOperators ||
      state.algorithm !== previous.algorithm ||
      state.dxFeedback !== previous.dxFeedback ||
      state.dxLfo !== previous.dxLfo ||
      state.dxPitchEnvelope !== previous.dxPitchEnvelope
    ) {
      show(state);
    }
  });
  show(store.get());
  const steps = document.createElement('span');
  steps.className = 'chooser preset-step';
  // Up and down, right of the name (Jeremy, 2026-10-21): up on, down back
  // (Jeremy, 2026-10-23: the other way was "wired in reverse").
  steps.append(...PRESET_STEP_KEYS.map(({ label, glyph, steps: by }) => step(label, glyph, by)));
  // Share, after them (Jeremy, 2026-10-25): a plain push key that copies
  // a link to the sound as it is now, the name's glass saying so. Where
  // the clipboard is refused, the link in a field to copy by hand.
  const shareBezel = document.createElement('span');
  shareBezel.className = 'lamp-keys preset-share';
  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'lamp-key preset-share-key';
  share.textContent = 'Share';
  share.setAttribute('aria-label', 'Copy a link to this sound');
  share.title = 'Copy a link to this sound';
  shareBezel.append(share);
  let saying = 0;
  const say = (text: string) => {
    window.clearTimeout(saying);
    name.textContent = text;
    name.classList.remove('is-edited');
    glitchScreens([name]);
    saying = window.setTimeout(() => show(store.get()), 1500);
  };
  const copy = () => {
    const link = soundLink(store.get(), window.location);
    const byHand = () => window.prompt('Copy this link to the sound:', link);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link).then(() => say('Link copied'), byHand);
    } else {
      byHand();
    }
  };
  // On the press, as every key here; Enter and Space through the click.
  share.addEventListener('pointerdown', event => {
    if (event.button === 0) copy();
  });
  share.addEventListener('click', event => {
    if (event.detail === 0) copy();
  });
  // No label of its own (Jeremy, 2026-10-22): the name on the glass says
  // what it is; for screen readers the group is named Presets.
  return [pick, steps, shareBezel, note];
}
