import { chapterById, CHAPTERS } from '../../chapters';
import { dbToIndex, detuned, keyOf, levelAtKey, rateScalingFactor } from '../../dsp/dx7';

const chapter = chapterById('dx7-voice')!;
const preset = (label: string) => chapter.presets.find(p => p.label === label)!.patch;

describe('A DX7 voice', () => {
  it('comes just before the sandbox and plays a DX7 voice, a note at a time', () => {
    expect(CHAPTERS[CHAPTERS.indexOf(chapter) + 1].id).toBe('sandbox');
    expect(chapter.patch).toMatchObject({ mode: 'ops', voiceModel: 'dx7', noteMode: true });
    expect(chapter.controls).toEqual(['volume']);
    expect(Object.keys(chapter.figures)).toEqual(['algorithm', 'spectrum']);
  });

  it('keeps every preset on algorithm 5, as its text and caption say', () => {
    for (const { patch } of chapter.presets) expect(patch.algorithm).toBe(5);
    expect(chapter.patch.dxOperators).toEqual(preset('Held').dxOperators);
  });

  it('gives the numbers its text gives', () => {
    // Held: OP2 at -12 dB is an index of about 3.2; full level about 12.6.
    expect(dbToIndex(preset('Held').dxOperators![1].level!)).toBeCloseTo(3.16, 2);
    expect(dbToIndex(0)).toBeCloseTo(12.57, 2);
    // Struck: OP1 falls 10 dB in 0.15 seconds.
    const struck = preset('Struck').dxOperators![0].envelope;
    expect([struck.peak - struck.brk, struck.decay1]).toEqual([10, 0.15]);
    // Detuned pair: 12 cents apart at 220 Hz is about 1.5 beats a second.
    const [op1, , op3] = preset('Detuned pair').dxOperators!;
    const beats = 220 * (detuned(op3.ratio, op3.detune) - detuned(op1.ratio, op1.detune));
    expect(beats).toBeCloseTo(1.52, 2);
    // And 7 cents at 440 Hz about 1.78.
    expect(440 * (detuned(1, 7) - 1)).toBeCloseTo(1.78, 2);
  });

  it('plays the high note plainer and shorter than the low one', () => {
    const low = preset('Low note');
    const high = preset('High note');
    expect(low.dxOperators).toEqual(high.dxOperators);
    const modulator = low.dxOperators![1];
    expect(modulator.breakKey).toBe(60);
    expect(levelAtKey(modulator, keyOf(low.carrierHz!))).toBe(-6);
    expect(levelAtKey(modulator, keyOf(high.carrierHz!))).toBeLessThan(-20);
    const speedUp = (hz: number) => rateScalingFactor(modulator.rateScaling, keyOf(hz));
    expect(speedUp(high.carrierHz!) / speedUp(low.carrierHz!)).toBeGreaterThan(2);
  });
});
