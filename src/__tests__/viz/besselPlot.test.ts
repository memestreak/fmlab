import { besselJ } from '../../dsp/bessel';
import { carsonBand, DEFAULTS, highlightOf, type LabState } from '../../model/lab';
import {
  CARRIER_VANISHES,
  indexAfterKey,
  indexText,
} from '../../ui/besselControls';
import {
  indexAt,
  labelIndex,
  MAX_ORDER,
  orderAt,
  orderLabel,
} from '../../viz/besselPlot';
import { ampToY, plotArea } from '../../viz/plot';
import { axisEnd, orderAtX, sidebandOrder } from '../../viz/spectrumPlot';

// A canvas the size the lab pane gives one on a desktop.
const WIDTH = 660;
const HEIGHT = 330;
const AREA = plotArea(WIDTH, HEIGHT);
/** The x pixel of an index on that canvas. */
const xOf = (index: number) => AREA.left + (index / 10) * (AREA.right - AREA.left);

describe('carsonBand', () => {
  it('reaches index + 1 modulator frequencies each side of the carrier', () => {
    expect(carsonBand(1 / 16, 3)).toEqual({ low: 0.75, high: 1.25 });
  });

  it('is one modulator frequency each side even with no modulation', () => {
    expect(carsonBand(0.25, 0)).toEqual({ low: 0.75, high: 1.25 });
  });

  it('stops at zero where the lower sidebands would fold', () => {
    // Chapter 3: ratio 1, so the band is 0 to index + 2 carriers.
    expect(carsonBand(1, 1)).toEqual({ low: 0, high: 3 });
    expect(carsonBand(1, 4)).toEqual({ low: 0, high: 6 });
  });

  it('always fits on the spectrum axis drawn for the same patch', () => {
    for (const ratio of [1 / 16, 0.5, 1, 3]) {
      for (const index of [0, 1, 2.4, 5, 10]) {
        expect(carsonBand(ratio, index).high).toBeLessThanOrEqual(axisEnd(ratio, index));
      }
    }
  });

  it('holds about 98% of the power', () => {
    // No folding at this ratio, so the power inside is a sum of J_n^2.
    for (const index of [1, 2, 5, 8]) {
      const reach = Math.floor(index + 1);
      let power = besselJ(0, index) ** 2;
      for (let n = 1; n <= reach; n++) power += 2 * besselJ(n, index) ** 2;
      expect(power).toBeGreaterThan(0.96);
    }
  });
});

describe('highlightOf', () => {
  const state = (hover: number | null, pinned: number | null): LabState => ({
    ...DEFAULTS,
    hover,
    pinned,
  });

  it('is nothing when nothing is pointed at or pinned', () => {
    expect(highlightOf(state(null, null))).toBeNull();
  });

  it('is the pinned order until something else is pointed at', () => {
    expect(highlightOf(state(null, 3))).toBe(3);
    expect(highlightOf(state(1, 3))).toBe(1);
  });

  it('can be the carrier, order 0', () => {
    expect(highlightOf(state(0, 3))).toBe(0);
    expect(highlightOf(state(null, 0))).toBe(0);
  });
});

describe('orderLabel', () => {
  it('writes the order as a subscript', () => {
    expect(orderLabel(0)).toBe('J₀');
    expect(orderLabel(8)).toBe('J₈');
    expect(orderLabel(12)).toBe('J₁₂');
  });
});

describe('indexAt', () => {
  it('reads the index off the plot area, to hundredths', () => {
    expect(indexAt(WIDTH, xOf(0))).toBe(0);
    expect(indexAt(WIDTH, xOf(10))).toBe(10);
    expect(indexAt(WIDTH, xOf(2.4))).toBe(2.4);
    expect(indexAt(WIDTH, xOf(5.123))).toBe(5.12);
  });

  it('stops at the ends when the pointer runs past them', () => {
    expect(indexAt(WIDTH, 0)).toBe(0);
    expect(indexAt(WIDTH, -50)).toBe(0);
    expect(indexAt(WIDTH, WIDTH + 50)).toBe(10);
  });
});

describe('orderAt', () => {
  const yOf = (order: number, index: number) => ampToY(AREA, besselJ(order, index));

  it('finds the curve under the pointer', () => {
    // J1 at its peak, and J0 where it is well clear of the others.
    expect(orderAt(WIDTH, HEIGHT, xOf(1.84), yOf(1, 1.84))).toBe(1);
    expect(orderAt(WIDTH, HEIGHT, xOf(0.5), yOf(0, 0.5))).toBe(0);
    expect(orderAt(WIDTH, HEIGHT, xOf(8.6), yOf(7, 8.6))).toBe(7);
  });

  it('takes the nearest curve where two run close', () => {
    const y = yOf(3, 4.2);
    expect(orderAt(WIDTH, HEIGHT, xOf(4.2), y + 2)).toBe(3);
  });

  it('finds nothing in the empty parts of the plot', () => {
    expect(orderAt(WIDTH, HEIGHT, xOf(0.5), ampToY(AREA, -0.8))).toBeNull();
    expect(orderAt(WIDTH, HEIGHT, xOf(9), ampToY(AREA, 0.9))).toBeNull();
  });

  it('finds nothing outside the plot area', () => {
    expect(orderAt(WIDTH, HEIGHT, AREA.left - 5, yOf(0, 0))).toBeNull();
    expect(orderAt(WIDTH, HEIGHT, AREA.right + 5, HEIGHT / 2)).toBeNull();
  });
});

describe('labelIndex', () => {
  it('puts each name at its curve\'s first peak', () => {
    // Tabulated first maxima of J1, J2 and J3.
    expect(labelIndex(1)).toBeCloseTo(1.84, 1);
    expect(labelIndex(2)).toBeCloseTo(3.05, 1);
    expect(labelIndex(3)).toBeCloseTo(4.2, 1);
  });

  it('keeps every name on the plot, left to right', () => {
    const places = Array.from({ length: MAX_ORDER + 1 }, (_, n) => labelIndex(n));
    for (let n = 1; n <= MAX_ORDER; n++) {
      expect(places[n]).toBeGreaterThan(places[n - 1]);
      expect(places[n]).toBeLessThan(10);
    }
  });
});

describe('the index line by keyboard', () => {
  it('moves a little for an arrow and a lot for a page key', () => {
    expect(indexAfterKey(2, 'ArrowRight')).toBe(2.05);
    expect(indexAfterKey(2, 'ArrowUp')).toBe(2.05);
    expect(indexAfterKey(2, 'ArrowLeft')).toBe(1.95);
    expect(indexAfterKey(2, 'ArrowDown')).toBe(1.95);
    expect(indexAfterKey(2, 'PageUp')).toBe(2.5);
    expect(indexAfterKey(2, 'PageDown')).toBe(1.5);
  });

  it('jumps to the ends, and stops there', () => {
    expect(indexAfterKey(2, 'Home')).toBe(0);
    expect(indexAfterKey(2, 'End')).toBe(10);
    expect(indexAfterKey(0, 'ArrowLeft')).toBe(0);
    expect(indexAfterKey(9.98, 'ArrowRight')).toBe(10);
  });

  it('leaves other keys alone, Tab above all', () => {
    expect(indexAfterKey(2, 'Tab')).toBeNull();
    expect(indexAfterKey(2, 'a')).toBeNull();
    expect(indexAfterKey(2, 'Enter')).toBeNull();
  });

  it('stays on hundredths after many presses', () => {
    let index = 0;
    for (let i = 0; i < 48; i++) index = indexAfterKey(index, 'ArrowRight')!;
    expect(index).toBe(2.4);
  });
});

describe('the carrier vanishing', () => {
  it('is where J0 first crosses zero', () => {
    expect(Math.abs(besselJ(0, CARRIER_VANISHES))).toBeLessThan(1e-3);
    expect(besselJ(0, CARRIER_VANISHES - 0.1)).toBeGreaterThan(0);
    expect(besselJ(0, CARRIER_VANISHES + 0.1)).toBeLessThan(0);
  });

  it('reads as itself, and a round index to two places', () => {
    expect(indexText(CARRIER_VANISHES)).toBe('2.405');
    expect(indexText(2)).toBe('2.00');
    expect(indexText(2.4)).toBe('2.40');
  });
});

describe('picking out sidebands on the spectrum', () => {
  const ratio = 1 / 16;
  const chapter4: LabState = { ...DEFAULTS, carrierHz: 880, ratio, index: 3 };
  const maxFreq = axisEnd(ratio, 3);
  /** The x pixel of a frequency, in carrier units, on that canvas. */
  const xOfFreq = (freq: number) =>
    AREA.left + (freq / maxFreq) * (AREA.right - AREA.left);

  it('numbers a line by its distance from the carrier', () => {
    expect(sidebandOrder(1, ratio)).toBe(0);
    expect(sidebandOrder(1 + 3 * ratio, ratio)).toBe(3);
    expect(sidebandOrder(1 - 3 * ratio, ratio)).toBe(3);
  });

  it('finds the order of the stem under the pointer, either side', () => {
    expect(orderAtX(chapter4, WIDTH, xOfFreq(1), MAX_ORDER)).toBe(0);
    expect(orderAtX(chapter4, WIDTH, xOfFreq(1 + 2 * ratio), MAX_ORDER)).toBe(2);
    expect(orderAtX(chapter4, WIDTH, xOfFreq(1 - 2 * ratio) + 3, MAX_ORDER)).toBe(2);
  });

  it('finds nothing between two stems', () => {
    expect(orderAtX(chapter4, WIDTH, xOfFreq(1 + 2.5 * ratio), MAX_ORDER)).toBeNull();
  });

  it('finds nothing for a sideband the Bessel plot has no curve for', () => {
    expect(orderAtX(chapter4, WIDTH, xOfFreq(1 + 9 * ratio), MAX_ORDER)).toBeNull();
    expect(orderAtX(chapter4, WIDTH, xOfFreq(0.05), MAX_ORDER)).toBeNull();
  });
});
