import { chapterByNumber, CHAPTERS, type Chapter, GLOSSARY } from '../../chapters';
import {
  chapterFromHash,
  hashForChapter,
  isStrayHash,
  paramsFromHash,
} from '../../chapters/route';
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

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');

describe('the terms', () => {
  it.each(TERM_IDS)('%s names itself in its definition, in a chapter that exists', id => {
    const { name, plain, chapter } = term(id);
    expect(plain.toLowerCase()).toContain(name.toLowerCase());
    expect(chapterByNumber(chapter)).toBeDefined();
    expect(plainText(id)).not.toMatch(/[<>]/);
    // One sentence.
    expect(plainText(id).replace(/\.$/, '')).not.toMatch(/\.\s/);
  });

  it('have names no two share', () => {
    const names = TERM_IDS.map(id => term(id).name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(TERM_IDS)('%s is defined in its own chapter, once, and nowhere else', id => {
    const marker = `data-defines="${id}"`;
    for (const chapter of CHAPTERS) {
      const count = allHtml(chapter).split(marker).length - 1;
      expect(count, `chapter ${chapter.number}`).toBe(chapter.number === term(id).chapter ? 1 : 0);
    }
    // In the lesson itself, not a caption or a panel, and as written here.
    expect(lessonHtml(chapterByNumber(term(id).chapter)!)).toContain(define(id));
  });

  it.each(TERM_IDS)('%s is not used before the chapter that defines it', id => {
    const { chapter: home, match } = term(id) as Term;
    for (const chapter of CHAPTERS.filter(c => c.number < home)) {
      expect(text(allHtml(chapter)), `chapter ${chapter.number}`).not.toMatch(match);
    }
  });

  it.each(TERM_IDS)('%s is defined at its first use in its chapter', id => {
    const { chapter: home, match } = term(id) as Term;
    const lesson = text(lessonHtml(chapterByNumber(home)!));
    const definedAt = lesson.indexOf(text(define(id)).trim());
    expect(definedAt).toBeGreaterThanOrEqual(0);
    const firstUse = lesson.search(match);
    expect(firstUse).toBeGreaterThanOrEqual(definedAt);
  });

  it.each(TERM_IDS.filter(id => (TERMS[id] as Term).formula))(
    '%s has its formula in its chapter\'s maths',
    id => {
      const maths = chapterByNumber(term(id).chapter)!.maths.flatMap(panel => panel.body);
      expect(maths).toContain(formula(id));
    },
  );

  it('marks only terms that exist, in chapters that come after them', () => {
    for (const chapter of CHAPTERS) {
      for (const [, id] of allHtml(chapter).matchAll(/data-term="(\w+)"/g)) {
        expect(TERM_IDS).toContain(id);
        expect(term(id as keyof typeof TERMS).chapter).toBeLessThanOrEqual(chapter.number);
      }
    }
  });
});

describe('the glossary', () => {
  const NUMBERS = CHAPTERS.map(chapter => chapter.number);

  it('lists every term once, alphabetically', () => {
    const order = glossaryOrder();
    expect([...order].sort()).toEqual([...TERM_IDS].sort());
    const names = order.map(id => term(id).name.toLowerCase());
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names[0]).toBe('adsr');
  });

  it('is at #glossary, an entry at #glossary?t=', () => {
    expect(chapterFromHash('#glossary', NUMBERS, 0)).toBe(GLOSSARY);
    expect(chapterFromHash(glossaryHash('index'), NUMBERS, 0)).toBe(GLOSSARY);
    expect(paramsFromHash(glossaryHash('index')).get('t')).toBe('index');
    expect(hashForChapter(GLOSSARY)).toBe('#glossary');
    expect(isStrayHash('#glossary', NUMBERS)).toBe(false);
    expect(isStrayHash('#glossaries', NUMBERS)).toBe(true);
    expect(chapterByNumber(GLOSSARY)?.title).toBe('Glossary');
  });

  it('links each term in the text to its entry, described by its definition', () => {
    const html = define('ratio');
    expect(html).toContain(`href="${glossaryHash('ratio')}"`);
    expect(html).toContain('aria-describedby="termdef-ratio"');
    expect(html.startsWith('The <dfn data-defines="ratio">')).toBe(true);
  });
});
