import { DX7_RATIO_STOPS, snapDx7Ratio, stepDx7Ratio } from '../../ui/voiceTable';
import { formatCents, formatDb, formatTime, parseNote } from '../../ui/voiceFormat';

describe('the DX7 voice\'s Ratio slider', () => {
  it('snaps to a half and the whole numbers to 31, the DX7\'s coarse ratios', () => {
    expect(DX7_RATIO_STOPS.slice(0, 3)).toEqual([0.5, 1, 2]);
    expect(DX7_RATIO_STOPS.at(-1)).toBe(31);
    expect(snapDx7Ratio(1.41)).toBe(1);
    expect(snapDx7Ratio(13.6)).toBe(14);
  });

  it('steps from stop to stop, and from between them to the next', () => {
    expect(stepDx7Ratio(1, 1)).toBe(2);
    expect(stepDx7Ratio(1.41, 1)).toBe(2);
    expect(stepDx7Ratio(1.41, -1)).toBe(1);
    expect(stepDx7Ratio(0.5, -1)).toBe(0.5);
  });
});

describe('the voice\'s numbers', () => {
  it('write times, levels and cents as the controls show them', () => {
    expect(formatTime(0)).toBe('0 ms');
    expect(formatTime(0.002)).toBe('2 ms');
    expect(formatTime(0.15)).toBe('150 ms');
    expect(formatTime(1.2)).toBe('1.2 s');
    expect(formatTime(12)).toBe('12 s');
    expect(formatDb(-18)).toBe('-18 dB');
    expect(formatDb(-96)).toBe('silent');
    expect(formatCents(2)).toBe('+2');
    expect(formatCents(-1.5)).toBe('-1.5');
    expect(formatCents(0)).toBe('0');
  });

  it('read a break point typed as a note', () => {
    expect(parseNote('C4')).toBe(60);
    expect(parseNote('c#3')).toBe(49);
    expect(parseNote('F♯2')).toBe(42);
    expect(parseNote('Bb4')).toBe(70);
    expect(parseNote('H2')).toBeUndefined();
  });
});
