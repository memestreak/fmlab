// The Reverb tab's response, worked out off the main thread (it takes up
// to a third of a second at 20 s): a module worker, bundled by Vite as
// the worklet is (ui/reverbView.ts imports it with ?worker).

import { type ResponseRequest, reverbResponse } from './reverbResponse';

self.onmessage = (event: MessageEvent<ResponseRequest>) => {
  const { id, ...request } = event.data;
  const { lows, highs } = reverbResponse(request);
  (self as unknown as Worker).postMessage({ id, lows, highs }, [lows.buffer, highs.buffer]);
};
