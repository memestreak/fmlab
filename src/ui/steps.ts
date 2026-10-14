import { chapterByNumber } from '../chapters';
import { currentStep, isLastStep } from '../chapters/steps';
import type { Chapter } from '../chapters/types';
import { algorithm } from '../dsp/algorithms';
import type { LabState, LabStore } from '../model/lab';

/** Where the text has its own scrolling column beside the lab. */
const PINNED = '(min-width: 62rem)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * A chapter built up in steps (chapter 8): a row of step buttons in the
 * lab, and a button at the head of each section of the text, both setting
 * that step's sound. Which step is current follows from the wiring in
 * force, so this also shows what belongs to a step: the algorithm list and
 * the presets only at the last, the Feedback slider only where there is a
 * loop. Mounted after the chapter view, so that what it hides stays
 * hidden after a change of chapter.
 */
export function mountSteps(store: LabStore): void {
  const row = document.querySelector<HTMLElement>('#steps');
  const narrative = document.querySelector<HTMLElement>('#narrative');
  if (!row) return;
  let shownFor: Chapter | undefined;

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
    const chapter = chapterByNumber(store.get().chapter);
    if (button && chapter) go(chapter, Number(button.dataset.step), false);
  });

  const build = (chapter: Chapter | undefined) => {
    shownFor = chapter;
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
    const hide = (selector: string, hidden: boolean) => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) el.hidden = hidden;
    };
    hide('#algorithm-picker', !last);
    hide('#presets', !last || chapter.presets.length === 0);
    hide('[data-control="feedback"]', !algorithm(state.algorithm).feedback);
  };

  store.subscribe((state, previous) => {
    if (state.chapter !== previous.chapter) build(chapterByNumber(state.chapter));
    if (state.chapter !== previous.chapter || state.algorithm !== previous.algorithm) {
      show(state);
    }
  });
  build(chapterByNumber(store.get().chapter));
  show(store.get());
}
