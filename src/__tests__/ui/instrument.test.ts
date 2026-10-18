import { CHAPTERS } from '../../chapters';
import { DEFAULTS } from '../../model/lab';
import { presetOf } from '../../ui/chapterView';
import { PLACES, stepAlgorithm } from '../../ui/instrument';

describe('the instrument page', () => {
  const sandbox = CHAPTERS.find(c => c.id === 'sandbox')!;

  it('is the sandbox alone, the last section, with six operators only', () => {
    expect(CHAPTERS.filter(c => c.instrument).map(c => c.id)).toEqual(['sandbox']);
    expect(CHAPTERS.at(-1)?.id).toBe('sandbox');
    expect(sandbox.patch.mode).toBe('ops');
    expect(sandbox.patch.noteMode).toBe(true);
    expect(sandbox.lede).toBe(
      "Six operators, wired by any of the DX7's 32 algorithms, starting from its factory voices (© Yamaha).",
    );
  });

  it('plays a DX7 voice from the keyboard, and opens on E.PIANO 1', () => {
    expect(sandbox.patch.voiceModel).toBe('dx7');
    expect(sandbox.controls).toEqual(['volume', 'dxFeedback']);
    expect(Object.keys(sandbox.figures)).toEqual(['algorithm', 'spectrum']);
    expect(sandbox.presets[10].label).toBe('11 E.PIANO 1');
    expect(sandbox.patch.dxOperators).toEqual(sandbox.presets[10].patch.dxOperators);
    expect(sandbox.hasPiano && sandbox.sharesSound).toBe(true);
    expect(sandbox.patch.algorithm).toBe(5);
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

describe('the sandbox\'s voice menu', () => {
  const sandbox = CHAPTERS.find(c => c.id === 'sandbox')!;
  const opening = { ...DEFAULTS, ...sandbox.patch };

  it('shows the voice the sound is, and none once it is edited', () => {
    expect(presetOf(sandbox.presets, opening)).toBe(10);
    const edited = {
      ...opening,
      dxOperators: opening.dxOperators.map((o, i) => (i === 0 ? { ...o, level: -5 } : o)),
    };
    expect(presetOf(sandbox.presets, edited)).toBe(-1);
    expect(presetOf(sandbox.presets, { ...opening, ...sandbox.presets[25].patch })).toBe(25);
  });
});
