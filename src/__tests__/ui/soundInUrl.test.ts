import { chapterById } from '../../chapters';
import { hashFor, soundParams } from '../../chapters/route';
import { DEFAULTS } from '../../model/lab';
import { addressAfterOpening, SOUND_IN_URL } from '../../ui/chapterView';

// Jeremy, 2026-10-23: "Let's not update the URL when the sound changes right now."
describe('the sound in the address', () => {
  const sandbox = chapterById('sandbox')!;
  const link = hashFor('sandbox', soundParams({ ...DEFAULTS, ...sandbox.patch, chapter: 'sandbox' }));

  it('is off for now', () => {
    expect(SOUND_IN_URL).toBe(false);
  });

  it('is read from a link, then the address is put back to #/sandbox', () => {
    expect(link.startsWith('#/sandbox?')).toBe(true);
    expect(addressAfterOpening(sandbox, link)).toBe('#/sandbox');
    // Nothing to put back on a plain address.
    expect(addressAfterOpening(sandbox, '#/sandbox')).toBeNull();
  });

  it('stays in the address with the switch on, as before', () => {
    expect(addressAfterOpening(sandbox, link, true)).toBeNull();
  });

  it('is taken out of a chapter that keeps no sound, but the glossary keeps its entry', () => {
    expect(addressAfterOpening(chapterById('ratio')!, '#/ratio?c=220')).toBe('#/ratio');
    expect(addressAfterOpening(chapterById('ratio')!, '#/ratio?c=220', true)).toBe('#/ratio');
    const glossary = chapterById('glossary');
    if (glossary) expect(addressAfterOpening(glossary, '#/glossary?t=index')).toBeNull();
  });
});
