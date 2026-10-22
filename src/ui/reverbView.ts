// The Voice section's Reverb tab (Jeremy, 2026-10-22): the plate reverb's
// screen (viz/reverbPlot.ts), four knobs under it, Pre-delay, Decay, Mix
// and Tone, and its On key at the row's right end. They set the Settings
// (model/settings.ts): the reverb belongs to the instrument, per browser,
// not to the voice, the link or a preset; the engine follows them.

import type { BandEnvelopes, ResponseRequest } from '../dsp/reverbResponse';
import ResponseWorker from '../dsp/reverbResponse.worker?worker';
import { inRange, SETTING_RANGES, settings } from '../model/settings';
import { describeReverb, drawReverb, type ReverbCurves, type ReverbView } from '../viz/reverbPlot';
import { createKnob } from './knob';
import { knobValues, redrawOnLayout } from './screenValues';

/** Pre-delay: "0 ms", "40 ms". */
export const formatPreDelay = (ms: number) => `${Math.round(ms)} ms`;
/** Decay: "1.5 s", "12 s" from 10 s up. */
export const formatDecay = (s: number) => (s < 9.95 ? `${s.toFixed(1)} s` : `${Math.round(s)} s`);
/** Mix: "25 %". */
export const formatMix = (mix: number) => `${Math.round(mix)} %`;

/** How many worked-out responses are kept, for stepping back and forth. */
const CACHE = 8;

/** The view of the settings the screen and the engine take: Pre-delay in seconds. */
function viewOf(): ReverbView {
  const now = settings.get();
  return {
    on: now.reverb === 'on',
    seconds: now.reverbDecay,
    mix: now.reverbMix,
    tone: now.reverbTone,
    preDelay: now.reverbPreDelay / 1000,
  };
}

/** Builds the Reverb tab and keeps it showing the settings. */
export function mountReverbView(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#inst-reverb-plot');
  const knobs = document.getElementById('inst-reverb-knobs');
  const key = document.querySelector<HTMLButtonElement>('#inst-reverb-on');
  if (!canvas || !knobs || !key) return;

  const now = () => settings.get();
  const built = [
    createKnob({
      label: 'Pre-delay',
      name: 'Reverb pre-delay',
      min: 1,
      max: SETTING_RANGES.reverbPreDelay.max,
      log: true,
      // Turned all the way down it is none: the tail starts with the sound.
      zero: true,
      get: () => now().reverbPreDelay,
      set: value => settings.set({ reverbPreDelay: inRange('reverbPreDelay', value) }),
      format: formatPreDelay,
    }),
    createKnob({
      label: 'Decay',
      name: 'Reverb decay',
      min: SETTING_RANGES.reverbDecay.min,
      max: SETTING_RANGES.reverbDecay.max,
      log: true,
      get: () => now().reverbDecay,
      set: value => settings.set({ reverbDecay: inRange('reverbDecay', value) }),
      format: formatDecay,
    }),
    createKnob({
      label: 'Mix',
      name: 'Reverb mix',
      min: SETTING_RANGES.reverbMix.min,
      max: SETTING_RANGES.reverbMix.max,
      get: () => now().reverbMix,
      set: value => settings.set({ reverbMix: inRange('reverbMix', value) }),
      format: formatMix,
    }),
    createKnob({
      label: 'Tone',
      name: 'Reverb tone',
      min: SETTING_RANGES.reverbTone.min,
      max: SETTING_RANGES.reverbTone.max,
      get: () => now().reverbTone,
      set: value => settings.set({ reverbTone: inRange('reverbTone', value) }),
      format: value => String(Math.round(value)),
    }),
  ];
  knobs.replaceChildren(...built.map(knob => knob.element));

  // On, a push key: it goes down or up on the press, as Key sync. Enter and
  // Space work it through the click.
  const flip = () => settings.set({ reverb: now().reverb === 'on' ? 'off' : 'on' });
  key.addEventListener('pointerdown', event => {
    if (event.button === 0) flip();
  });
  key.addEventListener('click', event => {
    if (event.detail === 0) flip();
  });

  // The response, worked out off the main thread: only the latest asked
  // counts, a newer request replacing the one waiting, and the last
  // results kept. The worker is made when the screen is first drawn.
  let worker: Worker | null = null;
  let asked = 0;
  let busy = false;
  let waiting: ResponseRequest | null = null;
  const cache = new Map<string, ReverbCurves>();
  /** The curves on the screen, and what they were worked out for. */
  let shown: { key: string; curves: ReverbCurves } | null = null;
  const keyOf = (r: Pick<ResponseRequest, 'seconds' | 'tone' | 'columns'>) => `${r.seconds}|${r.tone}|${r.columns}`;
  const requests = new Map<number, ResponseRequest>();
  const send = (request: ResponseRequest) => {
    busy = true;
    requests.set(request.id, request);
    worker?.postMessage(request);
  };
  /** What was last asked for: a reply for it is drawn; any other is kept, not shown. */
  let wanted = '';
  const ask = (seconds: number, tone: number, columns: number) => {
    const wantedNow = keyOf({ seconds, tone, columns });
    // Asked already, and on its way.
    if (wantedNow === wanted) return;
    wanted = wantedNow;
    const found = cache.get(wantedNow);
    if (found) {
      shown = { key: keyOf({ seconds, tone, columns }), curves: found };
      waiting = null;
      return;
    }
    const request: ResponseRequest = { id: ++asked, seconds, tone, columns, span: 1.25 * seconds };
    if (!worker) {
      worker = new ResponseWorker();
      worker.onmessage = (event: MessageEvent<BandEnvelopes & { id: number }>) => {
        busy = false;
        const sent = requests.get(event.data.id);
        requests.delete(event.data.id);
        if (sent) {
          const result: ReverbCurves = { lows: event.data.lows, highs: event.data.highs, span: sent.span };
          cache.set(keyOf(sent), result);
          if (cache.size > CACHE) cache.delete(cache.keys().next().value as string);
          // Only what was last asked is drawn; an older reply is kept, not shown.
          if (keyOf(sent) === wanted) {
            shown = { key: keyOf(sent), curves: result };
            draw();
          }
        }
        if (waiting) {
          const next = waiting;
          waiting = null;
          send(next);
        }
      };
    }
    if (busy) waiting = request;
    else send(request);
  };

  const draw = () => {
    const box = canvas.getBoundingClientRect();
    if (box.width === 0) return;
    const view = viewOf();
    // A column a pixel of the time the curves cover.
    const columns = Math.max(16, Math.round(box.width * ((1.25 * view.seconds) / (1.25 * view.seconds + view.preDelay))));
    // Decay and Tone need a new run; Mix and Pre-delay only move the
    // curves. Until it comes, the last curves stay on the screen.
    if (shown?.key !== keyOf({ seconds: view.seconds, tone: view.tone, columns })) ask(view.seconds, view.tone, columns);
    const curves = shown?.curves ?? null;
    drawReverb(canvas, curves, view, knobValues(canvas, knobs));
    canvas.setAttribute('aria-label', describeReverb(view, curves));
  };

  const show = () => {
    built.forEach(knob => knob.update());
    key.setAttribute('aria-pressed', String(now().reverb === 'on'));
    draw();
  };
  settings.subscribe((state, before) => {
    if (
      state.reverb !== before.reverb ||
      state.reverbDecay !== before.reverbDecay ||
      state.reverbMix !== before.reverbMix ||
      state.reverbTone !== before.reverbTone ||
      state.reverbPreDelay !== before.reverbPreDelay
    ) {
      show();
    }
  });
  // Drawn when shown (0 to a size), resized, or its knobs laid out anew;
  // never while hidden.
  new ResizeObserver(draw).observe(canvas);
  redrawOnLayout(knobs, draw);
  void document.fonts.ready.then(draw);
  built.forEach(knob => knob.update());
  key.setAttribute('aria-pressed', String(now().reverb === 'on'));
}
