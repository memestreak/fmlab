import { chapterById } from '../chapters';
import { currentStep, isLastStep } from '../chapters/steps';
import type { Chapter } from '../chapters/types';
import { algorithm } from '../dsp/algorithms';
import type { LabState, LabStore } from '../model/lab';

/** Where the text has its own scrolling column beside the lab. */
const PINNED = '(min-width: 62rem)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * A chapter built up in steps (chapter 8): a row of step buttons in the
 * Algorithm panel, and a button at the head of each section of the text,
 * both setting that step's sound. The last step, DX7 algorithms, swaps the
 * row for the list of the DX7's 32 and the presets, with Basic wirings to
 * come back to the step last left. Which step is current follows from the
 * wiring in force, so this also shows the Feedback slider only where there
 * is a loop. Mounted after the chapter view, so that what it shows and
 * hides wins after a change of chapter.
 */
export function mountSteps(store: LabStore): void {
  const row = document.querySelector<HTMLElement>('#steps');
  const dx7 = document.querySelector<HTMLElement>('#dx7-chooser');
  const presets = document.querySelector<HTMLElement>('#dx7-presets');
  const basic = document.querySelector<HTMLElement>('#basic-wirings');
  const narrative = document.querySelector<HTMLElement>('#narrative');
  if (!row) return;
  let shownFor: Chapter | undefined;
  /** The basic step to go back to from the DX7 list. */
  let lastBasic = 0;

  const go = (chapter: Chapter, index: number, scroll: boolean) => {
    const step = chapter.steps?.[index];
    if (!step) return;
    store.set(step.patch);
    // Where the text scrolls beside the lab, bring its section into view.
    // Where the lab sits above the text, the reader is already there.
    if (scroll && window.matchMedia(PINNED).matches) {
      narrative
        ?.querySelector(`[data-step-section="${index}"]`)
        ?.scrollIntoView({
          block: 'start',
          behavior: window.matchMedia(REDUCED_MOTION).matches ? 'auto' : 'smooth',
        });
    }
  };

  narrative?.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLElement>('[data-step]');
    const chapter = chapterById(store.get().chapter);
    if (button && chapter) go(chapter, Number(button.dataset.step), false);
  });
  basic?.addEventListener('click', () => {
    const chapter = chapterById(store.get().chapter);
    if (chapter) go(chapter, lastBasic, true);
  });

  const build = (chapter: Chapter | undefined) => {
    shownFor = chapter;
    lastBasic = 0;
    const steps = chapter?.steps ?? [];
    row.hidden = steps.length === 0;
    row.replaceChildren(
      ...steps.map((step, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'step-option';
        button.textContent = step.label;
        button.addEventListener('click', () => go(chapter!, index, true));
        return button;
      }),
    );
  };

  const show = (state: LabState) => {
    const chapter = shownFor;
    if (!chapter?.steps) return;
    const at = currentStep(chapter.steps, state.algorithm);
    const mark = (el: Element, here: boolean) => {
      if (here) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    };
    [...row.children].forEach((button, index) => mark(button, index === at));
    narrative?.querySelectorAll('[data-step]').forEach(button => {
      mark(button, Number((button as HTMLElement).dataset.step) === at);
    });
    const last = isLastStep(chapter.steps, at);
    if (!last) lastBasic = at;
    // One way of choosing at a time: the steps, or the DX7's list.
    row.hidden = last;
    if (dx7) dx7.hidden = !last;
    if (presets) presets.hidden = !last || chapter.presets.length === 0;
    const feedback = document.querySelector<HTMLElement>('[data-control="feedback"]');
    if (feedback) feedback.hidden = !algorithm(state.algorithm).feedback;
  };

  store.subscribe((state, previous) => {
    if (state.chapter !== previous.chapter) build(chapterById(state.chapter));
    if (state.chapter !== previous.chapter || state.algorithm !== previous.algorithm) {
      show(state);
    }
  });
  build(chapterById(store.get().chapter));
  show(store.get());
}
