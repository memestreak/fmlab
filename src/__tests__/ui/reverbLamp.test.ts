import { LAMP_HIT, lampPlace } from '../../ui/reverbLamp';

describe('the Reverb tab key\'s light', () => {
  it('is a 20px switch centred on the light, wherever the key is', () => {
    expect(LAMP_HIT).toBe(20);
    const holder = { left: 100, top: 50, width: 600, height: 40 };
    // A 5px light at (400, 70) to (405, 75): its centre at 402.5, 72.5.
    expect(lampPlace(holder, { left: 400, top: 70, width: 5, height: 5 })).toEqual({ left: 292.5, top: 12.5 });
    // The key on a line of its own, lower and further left.
    expect(lampPlace(holder, { left: 150, top: 95, width: 5, height: 5 })).toEqual({ left: 42.5, top: 37.5 });
  });
});
