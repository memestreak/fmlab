import { SEGMENTS, vfdCells } from '../../ui/vfdReadout';
import { formatLevel, formatRatio } from '../../ui/voiceTable';

/** The standard seven-segment table, segments a to g. */
const STANDARD: Record<string, string> = {
  0: 'abcdef',
  1: 'bc',
  2: 'abdeg',
  3: 'abcdg',
  4: 'bcfg',
  5: 'acdfg',
  6: 'acdefg',
  7: 'abc',
  8: 'abcdefg',
  9: 'abcdfg',
  '-': 'g',
  o: 'cdeg',
  F: 'aefg',
};

describe('the VFD readout\'s glyphs', () => {
  it('light the standard segments for every character it writes', () => {
    for (const [char, lit] of Object.entries(STANDARD)) {
      expect([...SEGMENTS[char]].sort().join('')).toBe(lit);
    }
  });

  it('fold each point into the place before it, four places, right-aligned', () => {
    expect(vfdCells('-30.8')).toEqual([
      { char: '-', point: false },
      { char: '3', point: false },
      { char: '0', point: true },
      { char: '8', point: false },
    ]);
    expect(vfdCells('1')).toEqual([
      { char: '', point: false },
      { char: '', point: false },
      { char: '', point: false },
      { char: '1', point: false },
    ]);
  });

  it('write off as o F F', () => {
    expect(vfdCells('off').map(c => c.char)).toEqual(['', 'o', 'F', 'F']);
  });

  it('fit every ratio and level the sandbox shows in four places', () => {
    for (const text of [formatRatio(0.5), formatRatio(1.41), formatRatio(61.69), formatLevel(-72), formatLevel(-30.75), formatLevel(0), formatLevel(-73)]) {
      const cells = vfdCells(text, 99).filter(c => c.char !== '' || c.point);
      expect(cells.length).toBeLessThanOrEqual(4);
    }
    expect(vfdCells(formatLevel(-72)).map(c => c.char + (c.point ? '.' : '')).join('')).toBe('-72.0');
  });

  it("writes the octave's first C, C1 to C5, in two places", () => {
    expect(SEGMENTS.C).toEqual(['a', 'd', 'e', 'f']);
    expect(vfdCells('C3', 2)).toEqual([
      { char: 'C', point: false },
      { char: '3', point: false },
    ]);
  });
});
