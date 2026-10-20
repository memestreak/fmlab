import { CHAPTERS, GLOSSARY, LANDING } from '../../chapters';
import { whereLine } from '../../ui/contents';

describe('the line beside Contents', () => {
  it('is empty on the sandbox, whose title bar is its voice', () => {
    expect(whereLine('sandbox')).toBe('');
  });

  it('still says where the reader is on every other page', () => {
    for (const chapter of CHAPTERS.filter(c => !c.instrument)) {
      expect(whereLine(chapter.id)).toMatch(new RegExp(` · ${chapter.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    }
    expect(whereLine(LANDING)).toBe('Introduction · Hearing FM');
    expect(whereLine(GLOSSARY)).toBe('Glossary');
  });
});
