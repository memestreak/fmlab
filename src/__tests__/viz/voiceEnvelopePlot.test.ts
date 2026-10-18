import type { Dx7Envelope } from '../../dsp/dx7';
import {
  dotAt,
  dotDragged,
  envelopeGeometry,
  largeArea,
  SLOTS,
  timeAt,
  timePosition,
} from '../../viz/voiceEnvelopePlot';

const env: Dx7Envelope = {
  attack: 0.002,
  peak: 0,
  decay1: 0.15,
  brk: -18,
  decay2: 0.8,
  sustain: -60,
  release: 0.2,
};
const area = largeArea(400, 120);

describe('the envelope drawing', () => {
  it('puts a time into its slot on a log scale, and back', () => {
    expect(timePosition(0)).toBe(0);
    expect(timePosition(40)).toBe(1);
    for (const seconds of [0.002, 0.15, 0.8, 5]) {
      expect(timeAt(timePosition(seconds))).toBeCloseTo(seconds, 9);
    }
  });

  it('runs its parts left to right, each dot in its own slot', () => {
    const { dots } = envelopeGeometry(env, area);
    const span = area.right - area.left;
    const inSlot = (x: number, [from, to]: readonly [number, number]) =>
      x >= area.left + span * from - 1e-9 && x <= area.left + span * to + 1e-9;
    expect(inSlot(dots.peak.x, SLOTS.attack)).toBe(true);
    expect(inSlot(dots.brk.x, SLOTS.decay1)).toBe(true);
    expect(inSlot(dots.sustain.x, SLOTS.decay2)).toBe(true);
    expect(inSlot(dots.release.x, SLOTS.release)).toBe(true);
    // Louder is higher.
    expect(dots.peak.y).toBeLessThan(dots.brk.y);
    expect(dots.brk.y).toBeLessThan(dots.sustain.y);
  });

  it('sets what a dot is dragged to, so a dot dropped where it is changes nothing', () => {
    const { dots } = envelopeGeometry(env, area);
    expect(dotDragged('brk', area, dots.brk.x, dots.brk.y)).toEqual({ decay1: 0.15, brk: -18 });
    expect(dotDragged('sustain', area, dots.sustain.x, dots.sustain.y)).toEqual({ decay2: 0.8, sustain: -60 });
    expect(dotDragged('release', area, dots.release.x, dots.release.y)).toEqual({ release: 0.2 });
    // Dragged higher, louder; never above full.
    expect(dotDragged('brk', area, dots.brk.x, area.top - 50).brk).toBe(0);
  });

  it('finds the dot under the pointer', () => {
    const { dots } = envelopeGeometry(env, area);
    expect(dotAt(env, area, dots.sustain.x + 3, dots.sustain.y - 2)).toBe('sustain');
    expect(dotAt(env, area, area.left + 1, area.bottom - 1)).toBeNull();
  });
});
