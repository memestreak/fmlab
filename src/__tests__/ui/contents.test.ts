import { CHAPTERS, GLOSSARY, LANDING, sequenceNeighbours } from '../../chapters';
import { whereLine, whereSteps } from '../../ui/contents';

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

describe('the arrows round the crumb', () => {
  const titleOf = (id: string) => CHAPTERS.find(c => c.id === id)!.title;

  it('go where the bottom links go, through the landing view to the sandbox', () => {
    expect(sequenceNeighbours(LANDING)).toEqual({ next: CHAPTERS[0] });
    expect(sequenceNeighbours(CHAPTERS[0].id).previous?.id).toBe(LANDING);
    expect(sequenceNeighbours(CHAPTERS[0].id).next).toBe(CHAPTERS[1]);
    const beforeSandbox = CHAPTERS.at(-2)!;
    expect(sequenceNeighbours(beforeSandbox.id).next?.id).toBe('sandbox');
    expect(sequenceNeighbours(GLOSSARY)).toEqual({});
  });

  it('keep the landing view\'s missing Previous in place, so the crumb holds still', () => {
    const { previous, next } = whereSteps(LANDING);
    expect(previous).toBe('kept');
    expect(next).toEqual({ to: CHAPTERS[0] });
  });

  it('name the section on each side', () => {
    const { previous, next } = whereSteps('vibrato');
    expect(typeof previous === 'object' && previous.to.title).toBe(titleOf('sine'));
    expect(typeof next === 'object' && next.to.title).toBe(titleOf('index'));
  });

  it('are not on the glossary or the sandbox', () => {
    expect(whereSteps(GLOSSARY)).toEqual({ previous: 'gone', next: 'gone' });
    expect(whereSteps('sandbox')).toEqual({ previous: 'gone', next: 'gone' });
  });
});
