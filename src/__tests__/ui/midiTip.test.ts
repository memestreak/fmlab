import { midiTip } from '../../ui/midi';

describe('the In key\'s tip', () => {
  it('names the keyboards heard, or says why none is', () => {
    expect(midiTip('off', [])).toBe('MIDI off');
    expect(midiTip('on', ['KeyStep 37', 'Launchkey 49'])).toBe('MIDI on: KeyStep 37, Launchkey 49');
    expect(midiTip('on', [])).toBe('MIDI on: no keyboard connected');
    expect(midiTip('waiting', ['KeyStep 37'])).toBe('Click anywhere to wake the sound');
    expect(midiTip('asking', [])).toBe('MIDI: asking the browser; allow it in the prompt by the address bar');
    expect(midiTip('blocked', [])).toBe(
      "MIDI blocked: allow it in the site's settings (in Brave: Settings, Site and Shields settings, MIDI devices)",
    );
    expect(midiTip('unsupported', [])).toBe('This browser has no MIDI: use Chrome, Edge, Brave or Firefox');
  });
});
