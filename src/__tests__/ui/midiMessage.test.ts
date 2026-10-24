import { curveVelocity, parseMidi } from '../../ui/midiMessage';

describe('a MIDI message', () => {
  it('is a note on with its velocity, or off at velocity 0 or as 0x80', () => {
    expect(parseMidi([0x90, 60, 100], 0)).toEqual({ type: 'noteOn', note: 60, velocity: 100 });
    expect(parseMidi([0x90, 60, 0], 0)).toEqual({ type: 'noteOff', note: 60 });
    expect(parseMidi([0x80, 60, 64], 0)).toEqual({ type: 'noteOff', note: 60 });
  });

  it('plays only a piano\'s keys, A0 to C8', () => {
    expect(parseMidi([0x90, 21, 90], 0)).toEqual({ type: 'noteOn', note: 21, velocity: 90 });
    expect(parseMidi([0x90, 108, 90], 0)).toEqual({ type: 'noteOn', note: 108, velocity: 90 });
    expect(parseMidi([0x90, 20, 90], 0)).toBeNull();
    expect(parseMidi([0x90, 109, 90], 0)).toBeNull();
    expect(parseMidi([0x80, 109, 0], 0)).toBeNull();
  });

  it('is the sustain pedal on CC64: down from 64', () => {
    expect(parseMidi([0xb0, 64, 64], 0)).toEqual({ type: 'pedal', down: true });
    expect(parseMidi([0xb0, 64, 127], 0)).toEqual({ type: 'pedal', down: true });
    expect(parseMidi([0xb0, 64, 63], 0)).toEqual({ type: 'pedal', down: false });
  });

  it('is the mod wheel on CC1, 0 to 1, settled to tenths of a percent', () => {
    expect(parseMidi([0xb0, 1, 0], 0)).toEqual({ type: 'wheel', amount: 0 });
    expect(parseMidi([0xb0, 1, 127], 0)).toEqual({ type: 'wheel', amount: 1 });
    expect(parseMidi([0xb0, 1, 64], 0)).toEqual({ type: 'wheel', amount: 0.504 });
  });

  it('is all off on CC120 and CC123, and nothing on other controllers', () => {
    expect(parseMidi([0xb0, 120, 0], 0)).toEqual({ type: 'allOff' });
    expect(parseMidi([0xb0, 123, 0], 0)).toEqual({ type: 'allOff' });
    expect(parseMidi([0xb0, 7, 100], 0)).toBeNull();
    expect(parseMidi([0xb0, 11, 100], 0)).toBeNull();
  });

  it('is the pitch wheel in 14 bits about 8192, -1 to 1', () => {
    expect(parseMidi([0xe0, 0x00, 0x40], 0)).toEqual({ type: 'bend', amount: 0 });
    expect(parseMidi([0xe0, 0x7f, 0x7f], 0)).toEqual({ type: 'bend', amount: 1 });
    expect(parseMidi([0xe0, 0x00, 0x00], 0)).toEqual({ type: 'bend', amount: -1 });
    expect(parseMidi([0xe0, 0x00, 0x20], 0)).toEqual({ type: 'bend', amount: -0.5 });
  });

  it('is heard on the channel set, or every channel at 0', () => {
    expect(parseMidi([0x93, 60, 90], 0)).toEqual({ type: 'noteOn', note: 60, velocity: 90 });
    expect(parseMidi([0x93, 60, 90], 4)).toEqual({ type: 'noteOn', note: 60, velocity: 90 });
    expect(parseMidi([0x93, 60, 90], 1)).toBeNull();
    expect(parseMidi([0x9f, 60, 90], 16)).toEqual({ type: 'noteOn', note: 60, velocity: 90 });
    expect(parseMidi([0xb1, 64, 127], 1)).toBeNull();
  });

  it('ignores system messages, program change, aftertouch and stray bytes', () => {
    expect(parseMidi([0xf8], 0)).toBeNull();
    expect(parseMidi([0xfe], 0)).toBeNull();
    expect(parseMidi([0xf0, 0x7e, 0xf7], 0)).toBeNull();
    expect(parseMidi([0xc0, 5], 0)).toBeNull();
    expect(parseMidi([0xd0, 60], 0)).toBeNull();
    expect(parseMidi([0xa0, 60, 30], 0)).toBeNull();
    expect(parseMidi([0x3c, 90], 0)).toBeNull();
    expect(parseMidi([], 0)).toBeNull();
  });
});

describe('the Velocity curve', () => {
  it('is the velocity as sent on Normal', () => {
    for (let v = 1; v <= 127; v++) expect(curveVelocity(v, 'normal')).toBe(v);
  });

  it('keeps 1 and 127 on every curve; Light plays 64 louder, Heavy softer', () => {
    for (const curve of ['light', 'normal', 'heavy'] as const) {
      expect(curveVelocity(1, curve)).toBe(1);
      expect(curveVelocity(127, curve)).toBe(127);
    }
    expect(curveVelocity(64, 'light')).toBeGreaterThan(64);
    expect(curveVelocity(64, 'heavy')).toBeLessThan(64);
    // 1 + 126 × (63 / 126) ^ 0.6 and ^ 1.6.
    expect(curveVelocity(64, 'light')).toBe(84);
    expect(curveVelocity(64, 'heavy')).toBe(43);
  });

  it('never falls below 1, and rises with the velocity', () => {
    for (const curve of ['light', 'heavy'] as const) {
      let last = 0;
      for (let v = 1; v <= 127; v++) {
        const out = curveVelocity(v, curve);
        expect(out).toBeGreaterThanOrEqual(Math.max(1, last));
        last = out;
      }
    }
  });
});
