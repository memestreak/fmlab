import { silentWav } from '../../audio/iosUnlock';

describe('silentWav', () => {
  const wav = silentWav();
  const text = (from: number, to: number) =>
    String.fromCharCode(...wav.subarray(from, to));

  it('has a WAV header that matches its length', () => {
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 12)).toBe('WAVE');
    expect(text(36, 40)).toBe('data');
    const view = new DataView(wav.buffer);
    expect(view.getUint32(4, true)).toBe(wav.length - 8);
    expect(view.getUint32(40, true)).toBe(wav.length - 44);
  });

  it('holds only silence, which is 128 in 8-bit audio', () => {
    expect(wav.subarray(44).every(byte => byte === 128)).toBe(true);
  });
});
