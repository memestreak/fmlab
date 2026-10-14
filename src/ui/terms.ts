import { plainText, TERM_IDS, type TermId } from '../chapters/terms';

/** Room kept between a tip and the edge of the window, in px. */
const MARGIN = 8;

/**
 * The defined terms in the text. Each is a link to its glossary entry,
 * underlined with dots; pointing at it or focusing it shows its
 * definition in a tip beside it. A tap shows the tip first, and a second
 * tap follows the link. For a screen reader each link is described by the
 * definition (`aria-describedby`), from a hidden list made here.
 */
export function mountTerms(): void {
  const definitions = document.createElement('div');
  definitions.hidden = true;
  for (const id of TERM_IDS) {
    const span = document.createElement('span');
    span.id = `termdef-${id}`;
    span.textContent = plainText(id);
    definitions.append(span);
  }

  const tip = document.createElement('div');
  tip.className = 'term-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(definitions, tip);

  let shownFor: HTMLElement | null = null;
  let lastPointer = '';

  const show = (link: HTMLElement) => {
    const id = link.dataset.term as TermId;
    tip.textContent = plainText(id);
    tip.hidden = false;
    shownFor = link;
    // Below the term, or above it if there is no room below; never off
    // either side of the window.
    const at = link.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    const left = Math.min(
      Math.max(MARGIN, at.left),
      window.innerWidth - width - MARGIN,
    );
    const below = at.bottom + 6;
    const top = below + height > window.innerHeight - MARGIN ? at.top - height - 6 : below;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };
  const hide = () => {
    tip.hidden = true;
    shownFor = null;
  };
  const termAt = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('a.term') : null;

  document.addEventListener('pointerover', event => {
    if (event.pointerType !== 'mouse') return;
    const link = termAt(event.target);
    if (link) show(link);
  });
  document.addEventListener('pointerout', event => {
    if (event.pointerType === 'mouse' && termAt(event.target)) hide();
  });
  document.addEventListener('focusin', event => {
    // A tap focuses the link too, before its click: the click decides.
    if (lastPointer === 'touch') return;
    const link = termAt(event.target);
    if (link) show(link);
  });
  document.addEventListener('focusout', event => {
    if (termAt(event.target)) hide();
  });
  document.addEventListener('pointerdown', event => {
    lastPointer = event.pointerType;
    if (!termAt(event.target)) hide();
  });
  // A tap on a term shows its tip; a second tap on it goes to the
  // glossary. A mouse or a key goes straight there.
  document.addEventListener('click', event => {
    const link = termAt(event.target);
    if (!link || lastPointer !== 'touch') return;
    if (shownFor !== link || tip.hidden) {
      event.preventDefault();
      show(link);
    }
    lastPointer = '';
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
  });
  // A tip left behind by scrolling would point at nothing.
  document.addEventListener('scroll', hide, true);
  window.addEventListener('hashchange', hide);
}
