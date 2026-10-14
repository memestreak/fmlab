import { chapterByNumber, CHAPTERS } from '../../chapters';
import { algorithm, ALGORITHMS, targetsOf } from '../../dsp/algorithms';
import { noteSeconds } from '../../dsp/envelope';
import {
  clamp,
  DEFAULTS,
  envelopeOf,
  FEEDBACK,
  type LabState,
  OP_DECAY,
  OP_LEVEL,
  OP_RATIO,
  operatorLevelsAt,
} from '../../model/lab';
import { roleOf } from '../../ui/operators';
import { describeAlgorithm, layoutAlgorithm } from '../../viz/algorithmPlot';
import { axisSpan, spectrumOf } from '../../viz/spectrumPlot';

/**
 * A state with a note started at `at` on the page's clock, as the engine
 * leaves it: with the note's length fixed from the patch at that moment.
 */
const started = (state: LabState, at: number): LabState => ({
  ...state,
  noteStartedAt: at,
  noteLength: noteSeconds(envelopeOf(state)),
});

const chapter8 = chapterByNumber(8)!;
const opened: LabState = { ...DEFAULTS, ...chapter8.patch, chapter: 8 };

describe('the algorithm diagram', () => {
  it.each(ALGORITHMS.map((alg, i) => [i + 1, alg] as const))(
    'lays out algorithm %i with carriers on the bottom and modulators above',
    (_, alg) => {
      const { places, columns, rows } = layoutAlgorithm(alg);
      for (let op = 0; op < 6; op++) {
        expect(places[op].row === 0).toBe(alg.carriers.includes(op));
        expect(places[op].column).toBeLessThan(columns);
        expect(places[op].row).toBeLessThan(rows);
      }
      targetsOf(alg).forEach((tos, from) => {
        for (const to of tos) expect(places[from].row).toBeGreaterThan(places[to].row);
      });
      // No two operators in one place.
      const cells = places.map(p => `${p.column},${p.row}`);
      expect(new Set(cells).size).toBe(6);
    },
  );

  it('stands a stack in one column', () => {
    const { places } = layoutAlgorithm(algorithm(1));
    expect([3, 4, 5].map(op => places[op].column)).toEqual([places[2].column, places[2].column, places[2].column]);
    expect([2, 3, 4, 5].map(op => places[op].row)).toEqual([0, 1, 2, 3]);
  });

  it('lays out the organ as one row of six', () => {
    const { places, rows, columns } = layoutAlgorithm(algorithm(32));
    expect(rows).toBe(1);
    expect(columns).toBe(6);
    expect(places.map(p => p.column)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('is described in words', () => {
    expect(describeAlgorithm(5)).toBe(
      'Algorithm 5: carriers OP1, OP3, OP5; OP2 modulates OP1; OP4 modulates OP3; ' +
        'OP6 modulates OP5; OP6 feeds back into itself.',
    );
    expect(describeAlgorithm(4)).toContain('OP4 feeds back into OP6');
    expect(describeAlgorithm(32)).toContain('no modulation');
  });
});

describe('chapter 8', () => {
  it('comes after the sandbox, and is the only chapter of six operators', () => {
    expect(CHAPTERS[CHAPTERS.length - 1]).toBe(chapter8);
    expect(CHAPTERS.filter(c => c.patch.mode === 'ops').map(c => c.number)).toEqual([8]);
  });

  it('shows the algorithm and the spectrum, and plays notes', () => {
    expect(Object.keys(chapter8.figures)).toEqual(['algorithm', 'spectrum']);
    expect(opened.noteMode).toBe(true);
    expect(chapter8.controls).toEqual(['volume', 'feedback']);
  });

  it('opens on algorithm 1, its stacks held', () => {
    expect(opened.algorithm).toBe(1);
    expect(opened.operators.every(op => op.decay === 0)).toBe(true);
  });

  it('has presets inside every range', () => {
    expect(chapter8.presets.map(preset => preset.label)).toEqual(
      ['Stacks', 'E. piano', 'Bass', 'Bell', 'Organ'],
    );
    for (const { patch } of chapter8.presets) {
      expect(patch.algorithm).toBeGreaterThanOrEqual(1);
      expect(patch.algorithm).toBeLessThanOrEqual(32);
      expect(clamp(patch.feedback!, FEEDBACK)).toBe(patch.feedback);
      expect(patch.operators).toHaveLength(6);
      for (const op of patch.operators!) {
        expect(clamp(op.ratio, OP_RATIO)).toBe(op.ratio);
        expect(clamp(op.level, OP_LEVEL)).toBe(op.level);
        expect(clamp(op.decay, OP_DECAY)).toBe(op.decay);
      }
    }
  });

  it('says which operators are carriers', () => {
    expect([0, 1, 2, 3, 4, 5].map(op => roleOf(1, op))).toEqual(
      ['carrier', 'modulator', 'carrier', 'modulator', 'modulator', 'modulator'],
    );
    expect(roleOf(32, 5)).toBe('carrier');
  });

  it('holds a note as long as its slowest operator, and lets go together', () => {
    const bell: LabState = { ...opened, ...chapter8.presets[3].patch };
    expect(noteSeconds(envelopeOf(bell))).toBeCloseTo(5.3, 9);
    expect(noteSeconds(envelopeOf(opened))).toBeCloseTo(1.3, 9);
  });

  it('shapes each operator by its own decay through a note', () => {
    const piano: LabState = started({ ...opened, ...chapter8.presets[1].patch }, 100);
    const early = operatorLevelsAt(piano, 100.01);
    const later = operatorLevelsAt(piano, 101);
    // The tine (OP4, 0.4 s) has nearly gone; the body (OP1, 2.5 s) has not.
    expect(later[3] / early[3]).toBeLessThan(0.01);
    expect(later[0] / early[0]).toBeGreaterThan(0.15);
    expect(operatorLevelsAt(piano, undefined)).toEqual(piano.operators.map(op => op.level));
  });

  it('predicts a richer spectrum as the stack goes up', () => {
    const quiet = spectrumOf({ ...opened, operators: opened.operators.map((op, i) => (i >= 3 ? { ...op, level: 0 } : op)) });
    expect(spectrumOf(opened).length).toBeGreaterThan(quiet.length);
  });

  it('predicts the organ\'s six partials at its ratios', () => {
    const organ: LabState = { ...opened, ...chapter8.presets[4].patch };
    const freqs = spectrumOf(organ).map(line => Math.round(line.freq * 100) / 100);
    expect(freqs).toEqual([0.5, 1, 2, 3, 4, 6]);
    expect(axisSpan(organ)).toBe(8);
  });
});
