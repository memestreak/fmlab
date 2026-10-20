import { keysArea } from '../../viz/keyScalingPlot';
import { pitchArea } from '../../viz/pitchEnvelopePlot';
import { VALUE_BAND } from '../../viz/plot';
import { largeArea } from '../../viz/voiceEnvelopePlot';

describe("the sandbox screens' value band", () => {
  it('is kept clear at the foot of every large screen', () => {
    // Everything drawn sits above the band, which holds the knobs' values.
    expect(largeArea(600, 200).bottom).toBeLessThanOrEqual(200 - VALUE_BAND);
    expect(pitchArea(600, 200).bottom).toBeLessThanOrEqual(200 - VALUE_BAND);
    const keys = keysArea(600, 200, true);
    expect(keys.keysTop + keys.keysHeight).toBeLessThanOrEqual(200 - VALUE_BAND);
  });

  it('leaves the table\'s small drawings their whole height', () => {
    const keys = keysArea(120, 34);
    expect(keys.keysTop + keys.keysHeight).toBe(34);
  });
});
