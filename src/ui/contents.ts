import { chapterById, GLOSSARY, landing, LANDING } from '../chapters';
import { groupOf, OUTLINE, type SectionId } from '../chapters/outline';
import { hashFor } from '../chapters/route';
import type { LabStore, LabState } from '../model/lab';

/**
 * The line beside Contents for a view: its group and its title, as
 * "Explore · Vibrato". Nothing for the sandbox, a synthesizer of its own
 * whose title bar is its voice's name (Contents still marks it), nor for
 * a view outside the outline.
 */
export function whereLine(id: string): string {
  const chapter = chapterById(id);
  if (chapter?.instrument) return '';
  const section = chapter && OUTLINE.some(g => g.sections.some(s => s.id === chapter.id));
  if (section) return `${groupOf(chapter.id as SectionId)} · ${chapter.title}`;
  if (chapter?.id === GLOSSARY || id === GLOSSARY) return 'Glossary';
  if (id === LANDING) return `Introduction · ${landing.title}`;
  return '';
}

/**
 * The header's Contents button and the panel it opens: every group and
 * its sections in order, then the glossary, with the one on screen
 * marked. The panel is a modal <dialog>, so it takes focus, keeps Tab
 * inside it, closes on Escape and hands focus back on closing; on a phone
 * it fills the screen. Choosing a section closes it. Beside the button,
 * where the reader is: the group and the section (`whereLine`).
 */
export function mountContents(store: LabStore): void {
  const open = document.querySelector<HTMLButtonElement>('#contents-open');
  const panel = document.querySelector<HTMLDialogElement>('#contents');
  const list = document.querySelector<HTMLElement>('#contents-list');
  const close = document.querySelector<HTMLButtonElement>('#contents-close');
  const where = document.querySelector<HTMLElement>('#where');
  if (!open || !panel || !list) return;

  list.innerHTML =
    `<h3 class="contents-group">Introduction</h3>
     <ol><li><a href="${hashFor(LANDING)}" data-id="${LANDING}">${landing.title}</a></li></ol>` +
    OUTLINE.map(
      ({ group, sections }) => `
        <h3 class="contents-group">${group}</h3>
        <ol>${sections
          .map(({ id, title }) => `<li><a href="${hashFor(id)}" data-id="${id}">${title}</a></li>`)
          .join('')}</ol>`,
    ).join('') +
    `<p class="contents-glossary"><a href="${hashFor(GLOSSARY)}" data-id="${GLOSSARY}">Glossary</a></p>`;

  const mark = (state: LabState) => {
    for (const link of list.querySelectorAll<HTMLAnchorElement>('a[data-id]')) {
      if (link.dataset.id === state.chapter) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (where) where.textContent = whereLine(state.chapter);
  };

  open.addEventListener('click', () => {
    panel.showModal();
    open.setAttribute('aria-expanded', 'true');
    // Start where the reader is.
    (list.querySelector<HTMLElement>('[aria-current]') ?? list.querySelector('a'))?.focus();
  });
  panel.addEventListener('close', () => open.setAttribute('aria-expanded', 'false'));
  close?.addEventListener('click', () => panel.close());
  // A choice closes the panel; the address change does the rest. So does
  // a click on the dimmed page around it.
  panel.addEventListener('click', event => {
    if (event.target === panel || (event.target as Element).closest('a')) panel.close();
  });

  store.subscribe((state, previous) => {
    if (state.chapter !== previous.chapter) mark(state);
  });
  mark(store.get());
}
