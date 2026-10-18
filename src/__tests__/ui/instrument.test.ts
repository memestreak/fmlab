import { CHAPTERS } from '../../chapters';
import { HINTS } from '../../chapters/sandbox';
import { orderOf, type SectionId } from '../../chapters/outline';
import { TERM_IDS, term, type Term } from '../../chapters/terms';
import { PLACES } from '../../ui/instrument';

describe('the instrument page', () => {
  it('is the sandbox alone, the last section', () => {
    expect(CHAPTERS.filter(c => c.instrument).map(c => c.id)).toEqual(['sandbox']);
    expect(CHAPTERS.at(-1)?.id).toBe('sandbox');
  });

  it('keeps Volume, Play, the switch, Copy link and the keys in both layouts', () => {
    for (const node of ['[data-control="volume"]', '#play', '#operator-count', '#share', '#piano']) {
      const spot = PLACES.find(p => p.node === node)!;
      expect(spot.two, node).toBe(spot.six);
      expect(spot.two, node).not.toBeNull();
    }
  });

  it('puts every control each layout shows somewhere on the page', () => {
    const sandbox = CHAPTERS.find(c => c.id === 'sandbox')!;
    for (const [layout, chapter] of [['two', sandbox], ['six', sandbox.sixOperators!]] as const) {
      for (const id of chapter.controls) {
        const spot = PLACES.find(p => p.node === `[data-control="${id}"]`);
        expect(spot?.[layout], `${layout} ${id}`).toBeTruthy();
      }
      for (const id of Object.keys(chapter.figures)) {
        const spot = PLACES.find(p => p.node === `[data-figure="${id}"]`);
        expect(spot?.[layout], `${layout} ${id}`).toBeTruthy();
      }
    }
  });

  it("has hints that use no term before the section defining it", () => {
    const text = Object.values(HINTS).join(' ');
    for (const id of TERM_IDS) {
      const { section, match } = term(id) as Term;
      if (match.test(text)) {
        expect(orderOf(section), id).toBeLessThan(orderOf('sandbox' as SectionId));
      }
    }
  });
});
