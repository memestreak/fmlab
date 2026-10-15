import { chapterById, CHAPTERS } from '../../chapters';
import { currentStep, isLastStep } from '../../chapters/steps';
import {
  algorithm,
  ALGORITHMS,
  isDx7,
  operatorsUsed,
  STEP_WIRINGS,
  targetsOf,
} from '../../dsp/algorithms';
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
import { carriersLabel, roleOf } from '../../ui/operators';
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

const chapter8 = chapterById('algorithms')!;
const opened: LabState = { ...DEFAULTS, ...chapter8.patch, chapter: 'algorithms' };

describe('the algorithm diagram', () => {
  it.each(ALGORITHMS.map((alg, i) => [i + 1, alg] as const))(
    'lays out algorithm %i with carriers on the bottom and modulators above',
    (_, alg) => {
      const { places, columns, rows } = layoutAlgorithm(alg);
      const used = operatorsUsed(alg);
      for (let op = 0; op < 6; op++) {
        // Only the operators it uses have a place.
        expect(places[op] !== undefined).toBe(used.includes(op));
      }
      for (const op of used) {
        expect(places[op]!.row === 0).toBe(alg.carriers.includes(op));
        expect(places[op]!.column).toBeLessThan(columns);
        expect(places[op]!.row).toBeLessThan(rows);
      }
      targetsOf(alg).forEach((tos, from) => {
        for (const to of tos) expect(places[from]!.row).toBeGreaterThan(places[to]!.row);
      });
      // No two operators in one place.
      const cells = used.map(op => `${places[op]!.column},${places[op]!.row}`);
      expect(new Set(cells).size).toBe(used.length);
    },
  );

  it('stands a stack in one column', () => {
    const { places } = layoutAlgorithm(algorithm(1));
    expect([3, 4, 5].map(op => places[op]!.column)).toEqual([places[2]!.column, places[2]!.column, places[2]!.column]);
    expect([2, 3, 4, 5].map(op => places[op]!.row)).toEqual([0, 1, 2, 3]);
  });

  it('lays out the organ as one row of six', () => {
    const { places, rows, columns } = layoutAlgorithm(algorithm(32));
    expect(rows).toBe(1);
    expect(columns).toBe(6);
    expect(places.map(p => p!.column)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('draws the pair as two boxes, one on the other', () => {
    const { places, rows, columns } = layoutAlgorithm(algorithm(STEP_WIRINGS.pair));
    expect([rows, columns]).toEqual([2, 1]);
    expect(places.slice(0, 2)).toEqual([{ column: 0, row: 0 }, { column: 0, row: 1 }]);
  });

  it('draws two modulators side by side over their carrier', () => {
    const { places, rows, columns } = layoutAlgorithm(algorithm(STEP_WIRINGS.twoModulators));
    expect([rows, columns]).toEqual([2, 2]);
    expect(places[1]!.row).toBe(1);
    expect(places[2]!.row).toBe(1);
  });

  it('is described in words', () => {
    expect(describeAlgorithm(5)).toBe(
      'Algorithm 5: carriers OP1, OP3, OP5; OP2 modulates OP1; OP4 modulates OP3; ' +
        'OP6 modulates OP5; OP6 feeds back into itself.',
    );
    expect(describeAlgorithm(4)).toContain('OP4 feeds back into OP6');
    expect(describeAlgorithm(32)).toContain('no modulation');
    expect(describeAlgorithm(STEP_WIRINGS.stack)).toBe(
      'Wiring: carrier OP1; OP2 modulates OP1; OP3 modulates OP2.',
    );
  });
});

describe('chapter 8', () => {
  it('follows the two-operator sections, and is the only section of six operators', () => {
    expect(CHAPTERS[CHAPTERS.indexOf(chapterById('envelopes')!) + 1]).toBe(chapter8);
    expect(CHAPTERS.filter(c => c.patch.mode === 'ops').map(c => c.id)).toEqual(['algorithms']);
  });

  it('shows the algorithm and the spectrum, and plays notes', () => {
    expect(Object.keys(chapter8.figures)).toEqual(['algorithm', 'spectrum']);
    expect(opened.noteMode).toBe(true);
    expect(chapter8.controls).toEqual(['volume', 'feedback']);
  });

  it('opens on its first step: the familiar pair, held', () => {
    expect(opened.algorithm).toBe(STEP_WIRINGS.pair);
    expect(chapter8.steps![0].patch.algorithm).toBe(STEP_WIRINGS.pair);
    expect(opened.operators.every(op => op.decay === 0)).toBe(true);
    // OP2 at 40%: an index of 2, as in chapter 3.
    expect(opened.operators[1].level).toBe(0.4);
  });

  it('builds up a step at a time, ending on the DX7 algorithms', () => {
    const steps = chapter8.steps!;
    expect(steps.map(step => step.label)).toEqual(
      ['One pair', 'Two pairs', 'Stack', 'Two into one', 'Feedback', 'DX7 algorithms'],
    );
    expect(steps.map(step => step.patch.algorithm)).toEqual([
      STEP_WIRINGS.pair,
      STEP_WIRINGS.twoPairs,
      STEP_WIRINGS.stack,
      STEP_WIRINGS.twoModulators,
      STEP_WIRINGS.feedback,
      1,
    ]);
    for (const step of steps) {
      expect(step.title).not.toBe('');
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.patch.operators).toHaveLength(6);
      // What a wiring leaves out is silent.
      const used = operatorsUsed(algorithm(step.patch.algorithm!));
      step.patch.operators!.forEach((op, i) => {
        if (!used.includes(i)) expect(op.level).toBe(0);
      });
    }
    // Feedback only where there is a loop to feed.
    expect(steps.filter(step => step.patch.feedback! > 0).map(step => step.label)).toEqual(['Feedback']);
  });

  it('knows its step from the wiring in force', () => {
    const steps = chapter8.steps!;
    expect(currentStep(steps, STEP_WIRINGS.pair)).toBe(0);
    expect(currentStep(steps, STEP_WIRINGS.feedback)).toBe(4);
    // Any of the 32 is the last step, whichever was chosen.
    expect(currentStep(steps, 1)).toBe(5);
    expect(currentStep(steps, 22)).toBe(5);
    expect(isLastStep(steps, 5)).toBe(true);
    expect(isLastStep(steps, 4)).toBe(false);
    // The presets belong to the last step: all DX7.
    expect(chapter8.presets.every(preset => isDx7(preset.patch.algorithm!))).toBe(true);
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
    expect([0, 1, 2].map(op => roleOf(STEP_WIRINGS.pair, op))).toEqual(['carrier', 'modulator', 'unused']);
  });

  it('names the algorithm list\'s groups', () => {
    expect(carriersLabel(1)).toBe('1 carrier');
    expect(carriersLabel(6)).toBe('6 carriers');
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
    const stacks: LabState = { ...opened, ...chapter8.presets[0].patch };
    const quiet = spectrumOf({ ...stacks, operators: stacks.operators.map((op, i) => (i >= 3 ? { ...op, level: 0 } : op)) });
    expect(spectrumOf(stacks).length).toBeGreaterThan(quiet.length);
    // And a step: OP3 on top of the pair thickens it.
    const stack: LabState = { ...opened, ...chapter8.steps![2].patch };
    const pair = { ...stack, operators: stack.operators.map((op, i) => (i === 2 ? { ...op, level: 0 } : op)) };
    expect(spectrumOf(stack).length).toBeGreaterThan(spectrumOf(pair).length);
  });

  it('predicts the organ\'s six partials at its ratios', () => {
    const organ: LabState = { ...opened, ...chapter8.presets[4].patch };
    const freqs = spectrumOf(organ).map(line => Math.round(line.freq * 100) / 100);
    expect(freqs).toEqual([0.5, 1, 2, 3, 4, 6]);
    expect(axisSpan(organ)).toBe(8);
  });
});
