import { chooseVoice, midiToHz, type VoiceState } from '../../dsp/voices';

const free = (): VoiceState => ({ note: null, struckAt: 0, releasedAt: null });
const held = (note: number, struckAt: number): VoiceState => ({ note, struckAt, releasedAt: null });
const released = (note: number, struckAt: number, releasedAt: number): VoiceState => ({
  note,
  struckAt,
  releasedAt,
});

describe('choosing a voice', () => {
  it('strikes a key already sounding on its own voice again', () => {
    expect(chooseVoice([held(60, 0), free(), held(64, 1)], 64)).toBe(2);
    expect(chooseVoice([released(60, 0, 5), free()], 60)).toBe(0);
  });

  it('takes a free voice next', () => {
    expect(chooseVoice([held(60, 0), free(), free()], 62)).toBe(1);
  });

  it('with none free, takes the voice let go longest ago', () => {
    const voices = [held(60, 0), released(62, 1, 9), released(64, 2, 4), held(65, 3)];
    expect(chooseVoice(voices, 67)).toBe(2);
  });

  it('with every voice held, takes the one struck first', () => {
    expect(chooseVoice([held(60, 5), held(62, 2), held(64, 7)], 67)).toBe(1);
  });
});

describe('a note\'s pitch', () => {
  it('is in equal temperament from A4 = 440 Hz', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(57)).toBe(220);
  });
});
