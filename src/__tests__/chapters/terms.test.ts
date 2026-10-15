import { chapterById, CHAPTERS, type Chapter, GLOSSARY } from '../../chapters';
import { landing } from '../../chapters/landing';
import {
  viewFromHash,
  hashFor,
  isStrayHash,
  paramsFromHash,
} from '../../chapters/route';
import { orderOf, type SectionId } from '../../chapters/outline';
import {
  define,
  formula,
  glossaryHash,
  glossaryOrder,
  plainText,
  type Term,
  term,
  TERM_IDS,
  TERMS,
  wikiLink,
  wikipedia,
} from '../../chapters/terms';

/** A chapter's paragraphs, then its steps' (not their headings). */
const paragraphs = (chapter: Chapter) => [
  ...chapter.body,
  ...(chapter.steps ?? []).flatMap(step => step.body),
];

/** A chapter's lesson, as one string. */
const lessonHtml = (chapter: Chapter) => paragraphs(chapter).join(' ');

/** Where a definition starts, in text with the markup taken out. */
const MARK = '⟦';
const marked = (html: string) => html.replace(/<dfn data-defines="\w+">/g, MARK);

/**
 * Text split into sentences: at a full stop, question or exclamation mark
 * followed by a capital, a quote, a bracket or a definition. "Fig. 2" is
 * not a sentence break.
 */
const sentences = (plain: string) => plain.split(/(?<=[.!?])\s+(?=[A-Z"(⟦])/);

/** Everything a chapter says: the lesson, the maths and the captions. */
const allHtml = (chapter: Chapter) =>
  [
    lessonHtml(chapter),
    ...chapter.maths.flatMap(panel => panel.body),
    ...Object.values(chapter.figures),
  ].join(' ');

// A link to another section is named by its title, which may say a term
// ("The modulation index") without using it: such links are left out.
const text = (html: string) =>
  html
    .replace(/<a href="#\/(?!glossary)[^"]*">[^<]*<\/a>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');

describe('the terms', () => {
  it.each(TERM_IDS)('%s names itself in its definition, in a section that exists', id => {
    const { name, plain, section } = term(id);
    expect(plain.toLowerCase()).toContain(name.toLowerCase());
    expect(chapterById(section)).toBeDefined();
    expect(plainText(id)).not.toMatch(/[<>]/);
    // One sentence.
    expect(plainText(id).replace(/\.$/, '')).not.toMatch(/\.\s/);
  });

  it('have names no two share', () => {
    const names = TERM_IDS.map(id => term(id).name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(TERM_IDS)('%s is defined in its own section, once, and nowhere else', id => {
    const marker = `data-defines="${id}"`;
    for (const chapter of CHAPTERS) {
      const count = allHtml(chapter).split(marker).length - 1;
      expect(count, chapter.id).toBe(chapter.id === term(id).section ? 1 : 0);
    }
    // In the lesson itself, not a caption or a panel.
    expect(lessonHtml(chapterById(term(id).section)!)).toContain(marker);
  });

  // In reading order, which outline.ts sets: not by any number.
  it.each(TERM_IDS)('%s is not used before the section that defines it', id => {
    const { section: home, match } = term(id) as Term;
    for (const chapter of CHAPTERS.filter(c => orderOf(c.id as SectionId) < orderOf(home))) {
      expect(text(allHtml(chapter)), chapter.id).not.toMatch(match);
    }
  });

  it.each(TERM_IDS)('%s is defined at its first use in its section', id => {
    const { section: home, match } = term(id) as Term;
    const lesson = text(
      lessonHtml(chapterById(home)!).replace(`<dfn data-defines="${id}">`, MARK),
    );
    const definedAt = lesson.indexOf(MARK);
    expect(definedAt).toBeGreaterThanOrEqual(0);
    const firstUse = lesson.search(match);
    expect(firstUse).toBeGreaterThanOrEqual(definedAt);
  });

  it.each(TERM_IDS.filter(id => (TERMS[id] as Term).formula))(
    '%s has its formula in its section\'s maths',
    id => {
      const maths = chapterById(term(id).section)!.maths.flatMap(panel => panel.body);
      expect(maths).toContain(formula(id));
    },
  );

  // One new idea at a time: the reader takes in each before the next.
  it.each(CHAPTERS.map(chapter => chapter.id))(
    '%s introduces at most one term a paragraph',
    id => {
      for (const html of paragraphs(chapterById(id)!)) {
        expect(html.split('data-defines=').length - 1, html).toBeLessThanOrEqual(1);
      }
    },
  );

  it.each(CHAPTERS.map(chapter => chapter.id))(
    '%s never defines terms in two sentences running',
    id => {
      const all = sentences(text(marked(lessonHtml(chapterById(id)!))));
      for (let i = 1; i < all.length; i++) {
        const both = all[i - 1].includes(MARK) && all[i].includes(MARK);
        expect(both, `${all[i - 1]} | ${all[i]}`).toBe(false);
      }
    },
  );

  it('marks only terms that exist, in sections that come after them', () => {
    for (const chapter of CHAPTERS) {
      for (const [, id] of allHtml(chapter).matchAll(/data-term="(\w+)"/g)) {
        expect(TERM_IDS).toContain(id);
        const home = term(id as keyof typeof TERMS).section;
        expect(orderOf(home)).toBeLessThanOrEqual(orderOf(chapter.id as SectionId));
      }
    }
  });
});

describe('the glossary', () => {
  const IDS = CHAPTERS.map(chapter => chapter.id);

  it('lists every term once, alphabetically', () => {
    const order = glossaryOrder();
    expect([...order].sort()).toEqual([...TERM_IDS].sort());
    const names = order.map(id => term(id).name.toLowerCase());
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names[0]).toBe('adsr');
  });

  it('is at #/glossary, an entry at #/glossary?t=', () => {
    expect(viewFromHash('#/glossary', IDS, 'landing')).toBe(GLOSSARY);
    expect(viewFromHash(glossaryHash('index'), IDS, 'landing')).toBe(GLOSSARY);
    expect(glossaryHash('index')).toBe('#/glossary?t=index');
    expect(paramsFromHash(glossaryHash('index')).get('t')).toBe('index');
    expect(hashFor(GLOSSARY)).toBe('#/glossary');
    expect(isStrayHash('#/glossary', IDS)).toBe(false);
    expect(isStrayHash('#/glossaries', IDS)).toBe(true);
    expect(chapterById(GLOSSARY)?.title).toBe('Glossary');
  });

  it('links each term in the text to its entry, described by its definition', () => {
    const html = define('ratio');
    expect(html).toContain(`href="${glossaryHash('ratio')}"`);
    expect(html).toContain('aria-describedby="termdef-ratio"');
    expect(html.startsWith('<dfn data-defines="ratio">')).toBe(true);
    expect(define('harmonic', 'harmonics')).toContain('>harmonics</a></dfn>');
  });

  it('links a term to English Wikipedia where it has an article', () => {
    expect(wikiLink('bessel')).toContain(
      'href="https://en.wikipedia.org/wiki/Bessel_function"',
    );
    expect(wikiLink('stack')).toBe('');
  });

  // Before there is a carrier the slider is the one wave's frequency.
  it('calls the carrier slider Frequency in A single sine only', () => {
    expect(chapterById('sine')!.labels).toEqual({ carrier: 'Frequency' });
    for (const chapter of CHAPTERS.filter(c => c.id !== 'sine')) {
      expect(chapter.labels, chapter.id).toBeUndefined();
    }
  });
});

describe('links out of the guide', () => {
  const views = [landing, ...CHAPTERS, ...CHAPTERS.flatMap(c => c.sixOperators ?? [])];
  const html = [
    ...views.map(allHtml),
    ...views.flatMap(view => view.maths.flatMap(panel => panel.body)),
    ...TERM_IDS.map(wikiLink),
  ].join(' ');
  const external = [...html.matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g)].map(m => m[0]);

  it('exist, to English Wikipedia', () => {
    expect(external.length).toBeGreaterThan(TERM_IDS.length);
    for (const tag of external) {
      expect(tag).toMatch(/href="https:\/\/en\.wikipedia\.org\/wiki\/[^"\s]+"/);
    }
  });

  it.each(external)('opens in a new tab, without the opener: %s', tag => {
    expect(tag).toMatch(/\btarget="_blank"/);
    expect(tag).toMatch(/\brel="[^"]*\bnoopener\b[^"]*"/);
  });

  it('marks a link out with an arrow and says it opens a new tab', () => {
    const link = wikipedia('Yamaha_DX7', 'Yamaha DX7');
    expect(link).toContain('↗');
    expect(link).toContain('opens in a new tab');
    expect(link).toContain('class="external"');
  });
});
