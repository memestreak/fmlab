import { type Envelope, envelopeAt, noteSeconds, TIME_CONSTANTS } from '../../dsp/envelope';
import { DEFAULTS, envelopeOf, indexAtTime, type LabState } from '../../model/lab';

const brass: Envelope = {
  attack: 0.1,
  decay: 0.1,
  sustain: 0.75,
  release: 0.15,
  hold: 0.6,
};

describe('envelopeAt', () => {
  it('starts at nothing', () => {
    expect(envelopeAt(brass, 0)).toBe(0);
    expect(envelopeAt(brass, -1)).toBe(0);
  });

  it('rises in a straight line to its peak over the attack', () => {
    expect(envelopeAt(brass, 0.025)).toBeCloseTo(0.25, 12);
    expect(envelopeAt(brass, 0.05)).toBeCloseTo(0.5, 12);
    expect(envelopeAt(brass, 0.1)).toBeCloseTo(1, 12);
  });

  it('settles towards the sustain level, fast at first', () => {
    // One time constant in (a quarter of the decay time), it has covered
    // 1 - 1/e of the way from the peak to the sustain level.
    const after = brass.attack + brass.decay / TIME_CONSTANTS;
    expect(envelopeAt(brass, after)).toBeCloseTo(0.75 + 0.25 / Math.E, 12);
  });

  it('is within 2% of the sustain level once the decay time is up', () => {
    const level = envelopeAt(brass, brass.attack + brass.decay);
    expect(level).toBeGreaterThan(0.75);
    expect(level - 0.75).toBeLessThan(0.02 * 0.25 + 1e-9);
  });

  it('holds there until the note is let go', () => {
    expect(envelopeAt(brass, 0.5)).toBeCloseTo(0.75, 4);
    expect(envelopeAt(brass, 0.6)).toBeCloseTo(0.75, 4);
  });

  it('dies away once let go, to within 2% by the end of the release', () => {
    const letGo = envelopeAt(brass, brass.hold);
    const quarter = brass.hold + brass.release / TIME_CONSTANTS;
    expect(envelopeAt(brass, quarter)).toBeCloseTo(letGo / Math.E, 12);
    expect(envelopeAt(brass, noteSeconds(brass))).toBeLessThan(0.02 * letGo + 1e-9);
  });

  it('has no jump anywhere', () => {
    let previous = 0;
    for (let t = 0; t <= noteSeconds(brass); t += 0.0005) {
      const level = envelopeAt(brass, t);
      expect(Math.abs(level - previous)).toBeLessThan(0.02);
      previous = level;
    }
  });

  it('stays between 0 and 1', () => {
    for (let t = 0; t <= 2; t += 0.01) {
      const level = envelopeAt(brass, t);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });

  it('releases from part way up when let go during the attack', () => {
    const early: Envelope = { ...brass, attack: 0.4, hold: 0.1 };
    expect(envelopeAt(early, 0.1)).toBeCloseTo(0.25, 12);
    expect(envelopeAt(early, 0.2)).toBeLessThan(0.25);
    expect(envelopeAt(early, 0.2)).toBeGreaterThan(0);
  });

  it('rings down to nothing with no sustain: a bell', () => {
    const bell: Envelope = { attack: 0.005, decay: 5, sustain: 0, release: 0.5, hold: 5 };
    expect(envelopeAt(bell, 0.005)).toBeCloseTo(1, 12);
    // Halving roughly every 0.87 s: ln 2 time constants of 1.25 s.
    expect(envelopeAt(bell, 0.005 + 1.25 * Math.LN2)).toBeCloseTo(0.5, 9);
    expect(envelopeAt(bell, 5)).toBeLessThan(0.02);
  });
});

describe('noteSeconds', () => {
  it('is the time held plus the release', () => {
    expect(noteSeconds(brass)).toBeCloseTo(0.75, 12);
  });
});

describe('the envelope in the lab state', () => {
  const state: LabState = { ...DEFAULTS, ...brass, index: 5 };

  it('is read out of the state', () => {
    expect(envelopeOf(state)).toEqual(brass);
  });

  it('shapes the index when the index follows it', () => {
    expect(indexAtTime(state, 0)).toBe(0);
    expect(indexAtTime(state, 0.05)).toBeCloseTo(2.5, 12);
    expect(indexAtTime(state, 0.1)).toBeCloseTo(5, 12);
    expect(indexAtTime(state, 0.5)).toBeCloseTo(3.75, 3);
  });

  it('leaves the index alone when it does not', () => {
    const steady = { ...state, indexFollows: false };
    for (const t of [0, 0.05, 0.5, 0.7]) expect(indexAtTime(steady, t)).toBe(5);
  });
});

describe('an envelope held until it is let go', () => {
  // Let go mid-attack, mid-decay and while sustaining: the release starts
  // from wherever the curve had got to, so there is no jump.
  it.each([0.05, 0.15, 1.5])('is continuous when let go at %s s', at => {
    const held: Envelope = { ...brass, hold: Infinity };
    const letGo: Envelope = { ...brass, hold: at };
    const before = envelopeAt(held, at);
    expect(envelopeAt(letGo, at)).toBeCloseTo(before, 12);
    expect(envelopeAt(letGo, at + 1e-6)).toBeCloseTo(before, 4);
    // And is the held envelope until then.
    expect(envelopeAt(letGo, at / 2)).toBe(envelopeAt(held, at / 2));
  });

  it('never ends while held', () => {
    expect(envelopeAt({ ...brass, hold: Infinity }, 100)).toBeCloseTo(brass.sustain, 12);
    expect(noteSeconds({ ...brass, hold: Infinity })).toBe(Infinity);
  });
});

