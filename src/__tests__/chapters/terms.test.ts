import { chapterById, CHAPTERS, type Chapter, GLOSSARY } from '../../chapters';
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
} from '../../chapters/terms';

/** A chapter's lesson: its paragraphs, then its steps' (not their headings). */
const lessonHtml = (chapter: Chapter) =>
  [...chapter.body, ...(chapter.steps ?? []).flatMap(step => step.body)].join(' ');

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
    // In the lesson itself, not a caption or a panel, and as written here.
    expect(lessonHtml(chapterById(term(id).section)!)).toContain(define(id));
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
    const lesson = text(lessonHtml(chapterById(home)!));
    const definedAt = lesson.indexOf(text(define(id)).trim());
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
    expect(html.startsWith('The <dfn data-defines="ratio">')).toBe(true);
  });
});
