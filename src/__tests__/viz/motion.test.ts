import { fmWindowSample, trueFmSample } from '../../dsp/waveform';
import { CHAPTERS } from '../../chapters';
import { DEFAULTS, type LabState } from '../../model/lab';
import { motionNote, waveformMoves } from '../../ui/figures';
import { msTicks } from '../../viz/ticks';
import { motionView } from '../../viz/waveformPlot';

const fm = (modHz: number, deviationHz = 20, more: Partial<LabState> = {}): LabState => ({
  ...DEFAULTS,
  mode: 'fm',
  carrierHz: 220,
  modHz,
  deviationHz,
  ...more,
});

describe('fmWindowSample', () => {
  it('is a plain sine from the left edge with no deviation', () => {
    for (const offset of [0, 0.001, 0.0123]) {
      expect(fmWindowSample(3.3, offset, 44, 5, 0)).toBeCloseTo(
        Math.sin(2 * Math.PI * 44 * offset),
        12,
      );
    }
  });

  it('always starts at zero at the left edge, whenever the window opens', () => {
    for (const start of [0, 0.03, 0.11, 7.7]) {
      expect(fmWindowSample(start, 0, 44, 5, 20)).toBeCloseTo(0, 12);
    }
  });

  it('is the signal itself for a window that opens at the start', () => {
    // One wobble of 5 Hz on 220 Hz, against trueFmSample in carrier cycles.
    for (const offset of [0.01, 0.05, 0.13, 0.2]) {
      expect(fmWindowSample(0, offset, 220, 5, 20)).toBeCloseTo(
        trueFmSample(offset * 220, 5 / 220, 20 / 5),
        9,
      );
    }
  });

  it('repeats once every cycle of the modulator', () => {
    for (const offset of [0.02, 0.09]) {
      expect(fmWindowSample(0.07 + 1 / 5, offset, 44, 5, 20)).toBeCloseTo(
        fmWindowSample(0.07, offset, 44, 5, 20),
        9,
      );
    }
  });

  it('runs ahead of the plain carrier while the pitch is high', () => {
    // The first half of a wobble is all above the carrier: a quarter of a
    // carrier cycle in, the phase is already past a quarter turn.
    const phaseAhead = (20 / 5) * (1 - Math.cos(2 * Math.PI * 5 * 0.005));
    expect(fmWindowSample(0, 0.005, 50, 5, 20)).toBeCloseTo(
      Math.sin(Math.PI / 2 + phaseAhead),
      12,
    );
  });
});

describe('motionView', () => {
  it('has none for phase modulation', () => {
    expect(motionView(DEFAULTS)).toBeNull();
  });

  it('has none once the still view can hold two wobbles', () => {
    // On 220 Hz that is from 11 Hz up.
    expect(motionView(fm(11))).toBeNull();
    expect(motionView(fm(200))).toBeNull();
    expect(motionView(fm(10.9))).not.toBeNull();
  });

  it('slows the default vibrato five times and shows one whole wobble', () => {
    const view = motionView(fm(5, 20))!;
    expect(view.slow).toBe(5);
    expect(view.shownHz).toBe(44);
    expect(view.seconds).toBeCloseTo(0.2, 12);
  });

  it('never slows the carrier to within reach of the deviation', () => {
    for (const deviationHz of [0, 5, 20, 60, 120, 200]) {
      for (const modHz of [0.5, 2, 5, 10]) {
        const view = motionView(fm(modHz, deviationHz))!;
        expect(view.shownHz).toBeGreaterThan(deviationHz);
        expect(view.slow).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('leaves the carrier at its true speed under a deep vibrato', () => {
    expect(motionView(fm(5, 200))!.slow).toBe(1);
  });

  it('cuts the window short rather than crowd it', () => {
    // 0.5 Hz: a whole wobble is two seconds, far too many cycles.
    const view = motionView(fm(0.5, 20))!;
    expect(view.seconds).toBeLessThan(2);
    expect(view.seconds * view.shownHz).toBeCloseTo(24, 9);
  });

  it('never shows more than 24 carrier cycles, or more than one wobble', () => {
    for (const deviationHz of [0, 20, 200]) {
      for (const modHz of [0.5, 1, 3, 5, 8, 10.9]) {
        const view = motionView(fm(modHz, deviationHz))!;
        expect(view.seconds * view.shownHz).toBeLessThanOrEqual(24 + 1e-9);
        expect(view.seconds).toBeLessThanOrEqual(1 / modHz + 1e-12);
      }
    }
  });
});

describe('msTicks', () => {
  it('numbers one 5 Hz wobble every 50 ms, in ms only', () => {
    const ticks = msTicks(0.2);
    expect(ticks.map(tick => tick.label)).toEqual(['0', '50', '100', '150', '200']);
    expect(ticks.every(tick => tick.sub === '')).toBe(true);
    expect(ticks[4].at).toBeCloseTo(0.2, 12);
  });

  it('uses bigger steps for a longer window', () => {
    expect(msTicks(2).map(tick => tick.label)).toEqual(
      ['0', '500', '1000', '1500', '2000'],
    );
    expect(msTicks(0.11).map(tick => tick.label)).toEqual(
      ['0', '20', '40', '60', '80', '100'],
    );
  });
});

describe('waveformMoves', () => {
  it('moves while sound plays, or with Show motion on', () => {
    expect(waveformMoves(fm(5), false)).toBe(false);
    expect(waveformMoves(fm(5, 20, { playing: true }), false)).toBe(true);
    expect(waveformMoves(fm(5, 20, { motion: true }), false)).toBe(true);
  });

  it('never moves for someone who asked for reduced motion', () => {
    expect(waveformMoves(fm(5, 20, { playing: true, motion: true }), true)).toBe(false);
  });

  it('never moves where there is no moving view', () => {
    expect(waveformMoves({ ...DEFAULTS, playing: true, motion: true }, false)).toBe(false);
    expect(waveformMoves(fm(100, 20, { playing: true }), false)).toBe(false);
  });
});

describe('motionNote', () => {
  it('says how much the carrier is slowed while it moves', () => {
    expect(motionNote(fm(5, 20, { playing: true }), false)).toBe(
      'In motion, with the carrier drawn 5 times slower than it sounds.',
    );
  });

  it('says so when the carrier is not slowed at all', () => {
    expect(motionNote(fm(5, 200, { motion: true }), false)).toBe(
      'In motion, with the carrier at its true speed.',
    );
  });

  it('is empty while the figure is still by choice, or has no moving view', () => {
    expect(motionNote(fm(5), false)).toBe('');
    expect(motionNote(fm(100, 20, { playing: true }), false)).toBe('');
    expect(motionNote({ ...DEFAULTS, playing: true }, false)).toBe('');
  });

  it('explains a figure held still for reduced motion', () => {
    expect(motionNote(fm(5, 20, { playing: true }), true)).toContain('reduced motion');
  });
});

describe('Show motion', () => {
  it('is offered by chapter 2 alone', () => {
    expect(CHAPTERS.filter(c => c.hasMotion).map(c => c.number)).toEqual([2]);
  });
});
