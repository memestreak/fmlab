import { CHAPTERS } from '../../chapters';
import { PLACES } from '../../ui/instrument';

describe('the instrument page', () => {
  const sandbox = CHAPTERS.find(c => c.id === 'sandbox')!;

  it('is the sandbox alone, the last section, with six operators only', () => {
    expect(CHAPTERS.filter(c => c.instrument).map(c => c.id)).toEqual(['sandbox']);
    expect(CHAPTERS.at(-1)?.id).toBe('sandbox');
    expect(sandbox.patch.mode).toBe('ops');
    expect(sandbox.patch.noteMode).toBe(true);
    expect(sandbox.lede).toBe("Six operators, wired by any of the DX7's 32 algorithms.");
  });

  it('has chapter 8\'s pieces and the keyboard, and starts from Stacks', () => {
    expect(sandbox.controls).toEqual(['volume', 'feedback']);
    expect(Object.keys(sandbox.figures)).toEqual(['algorithm', 'spectrum']);
    expect(sandbox.presets).toBe(CHAPTERS.find(c => c.id === 'algorithms')!.presets);
    expect(sandbox.hasPiano && sandbox.sharesSound).toBe(true);
    expect(sandbox.patch.algorithm).toBe(1);
  });

  it('puts every control and figure it shows somewhere on the page', () => {
    for (const id of sandbox.controls) {
      expect(PLACES.some(p => p.node === `[data-control="${id}"]`), id).toBe(true);
    }
    for (const id of Object.keys(sandbox.figures)) {
      expect(PLACES.some(p => p.node === `[data-figure="${id}"]`), id).toBe(true);
    }
    for (const node of ['#piano', '#algorithm', '.panel-operators']) {
      expect(PLACES.some(p => p.node === node), node).toBe(true);
    }
  });

  it('has no Play or Copy link: the keys play, the address keeps the sound', () => {
    for (const node of ['#play', '#share']) {
      expect(PLACES.some(p => p.node === node), node).toBe(false);
    }
  });
});
