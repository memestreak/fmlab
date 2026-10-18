import { CHAPTERS } from '../../chapters';
import { PLACES, stepAlgorithm } from '../../ui/instrument';

describe('the instrument page', () => {
  const sandbox = CHAPTERS.find(c => c.id === 'sandbox')!;

  it('is the sandbox alone, the last section, with six operators only', () => {
    expect(CHAPTERS.filter(c => c.instrument).map(c => c.id)).toEqual(['sandbox']);
    expect(CHAPTERS.at(-1)?.id).toBe('sandbox');
    expect(sandbox.patch.mode).toBe('ops');
    expect(sandbox.patch.noteMode).toBe(true);
    expect(sandbox.lede).toBe("Six operators, wired by any of the DX7's 32 algorithms.");
  });

  it('plays a DX7 voice from the keyboard, and starts from Stacks', () => {
    expect(sandbox.patch.voiceModel).toBe('dx7');
    expect(sandbox.controls).toEqual(['volume', 'dxFeedback']);
    expect(Object.keys(sandbox.figures)).toEqual(['algorithm', 'spectrum']);
    expect(sandbox.presets[0].label).toBe('Stacks');
    expect(sandbox.patch.dxOperators).toEqual(sandbox.presets[0].patch.dxOperators);
    expect(sandbox.hasPiano && sandbox.sharesSound).toBe(true);
    expect(sandbox.patch.algorithm).toBe(1);
  });

  it('keeps Operators and algorithms on its simple operators', () => {
    expect(CHAPTERS.find(c => c.id === 'algorithms')!.patch.voiceModel).toBe('basic');
  });

  it('puts every control and figure it shows somewhere on the page', () => {
    for (const id of sandbox.controls) {
      expect(PLACES.some(p => p.node === `[data-control="${id}"]`), id).toBe(true);
    }
    for (const id of Object.keys(sandbox.figures)) {
      expect(PLACES.some(p => p.node === `[data-figure="${id}"]`), id).toBe(true);
    }
    // The operator table and envelope view are the instrument page's own.
    for (const node of ['#piano', '#algorithm']) {
      expect(PLACES.some(p => p.node === node), node).toBe(true);
    }
  });

  it('has no Play or Copy link: the keys play, the address keeps the sound', () => {
    for (const node of ['#play', '#share']) {
      expect(PLACES.some(p => p.node === node), node).toBe(false);
    }
  });

  it('steps through the 32 algorithms either way, round the ends', () => {
    expect(stepAlgorithm(1, 1)).toBe(2);
    expect(stepAlgorithm(5, -1)).toBe(4);
    expect(stepAlgorithm(32, 1)).toBe(1);
    expect(stepAlgorithm(1, -1)).toBe(32);
  });
});
