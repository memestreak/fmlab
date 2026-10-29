// The sandbox's Voice section: four tabs, Algorithm (the chooser, the
// diagram and Feedback), LFO, Pitch EG (ui/pitchEgView.ts) and Reverb
// (ui/reverbView.ts; Jeremy, 2026-10-22). The
// sandbox opens on Algorithm, and comes back within a visit on the tab it
// was left on; which tab is open is the page's alone, in neither the link
// nor storage. While the LFO, the Pitch EG or
// the Reverb tab is closed its pill shows a dot when that feature is on. The LFO tab: the wave, six buttons each drawing its shape, with
// a drawing of the LFO under them (viz/lfoPlot.ts); Speed, Delay,
// Vibrato and Tremolo, and what the mod wheel adds to those two at full,
// Wheel vibrato and Wheel tremolo: six knobs; and key sync, a push key,
// "Key sync".

import {
  type Dx7Lfo,
  LFO_DELAY,
  LFO_SPEED,
  LFO_TREMOLO,
  LFO_VIBRATO,
  LFO_WAVES,
  type LfoWave,
  lfoOn,
  pitchEnvelopeOn,
} from '../dsp/dx7';
import { dx7LfoDelay, dx7TremoloDb, dx7VibratoCents } from '../dsp/lfo';
import type { LabStore } from '../model/lab';
import { knobValues, redrawOnLayout } from './screenValues';
import { describeLfo, drawLfo } from '../viz/lfoPlot';
import { createKnob } from './knob';
import { glitchScreens } from './screenGlitch';
import { formatTime } from './voiceFormat';

type VoiceArea = 'algorithm' | 'lfo' | 'pitch' | 'reverb';

/** Each tab's screen, the canvas whose glass glitches when it opens. */
const SCREENS: Record<VoiceArea, string> = {
  algorithm: 'algorithm-plot',
  lfo: 'inst-lfo-plot',
  pitch: 'inst-pitch-curve',
  reverb: 'inst-reverb-plot',
};

/** Each wave's name and its button's drawing (an SVG path in 24 × 16). */
const WAVES: Record<LfoWave, { name: string; path: string }> = {
  triangle: { name: 'Triangle', path: 'M2 12 L7 4 L12 12 L17 4 L22 12' },
  sawDown: { name: 'Saw down', path: 'M2 4 L11 12 L11 4 L20 12 L20 4' },
  sawUp: { name: 'Saw up', path: 'M2 12 L11 4 L11 12 L20 4 L20 12' },
  square: { name: 'Square', path: 'M2 12 V4 H8 V12 H14 V4 H20 V12 H22' },
  sine: { name: 'Sine', path: 'M2 8 Q5.5 0 9 8 T16 8 T23 8' },
  sampleHold: { name: 'Sample and hold', path: 'M2 10 H6 V5 H10 V12 H14 V7 H18 V11 H22' },
};

/** Speed in Hz: "0.13 Hz", "5.0 Hz", "24 Hz". */
export function formatHz(hz: number): string {
  return `${hz < 1 ? hz.toFixed(2) : hz < 10 ? hz.toFixed(1) : Math.round(hz)} Hz`;
}

/** Vibrato in cents: "0 ¢", "7.3 ¢", "28 ¢", "1191 ¢". */
export function formatCentsSwing(cents: number): string {
  return `${cents === 0 ? 0 : cents < 10 ? Number(cents.toFixed(1)) : Math.round(cents)} ¢`;
}

/** Tremolo in dB: "0 dB", "0.84 dB", "12 dB", "92 dB". */
export function formatPull(db: number): string {
  return `${db === 0 ? 0 : db < 1 ? Number(db.toFixed(2)) : Number(db.toPrecision(2))} dB`;
}

const SVG = 'http://www.w3.org/2000/svg';

/** Builds the Voice section's tabs and the LFO tab, and keeps them showing the store. */
export function mountVoiceArea(store: LabStore): void {
  const head = document.querySelector<HTMLElement>('.inst-alg-head');
  const waves = document.getElementById('inst-lfo-waves');
  const knobs = document.getElementById('inst-lfo-knobs');
  const plot = document.querySelector<HTMLCanvasElement>('#inst-lfo-plot');
  const sync = document.querySelector<HTMLButtonElement>('#inst-lfo-sync');
  if (!head || !waves || !knobs || !plot || !sync) return;

  const lfo = () => store.get().dxLfo;
  const setLfo = (patch: Partial<Dx7Lfo>) => store.set({ dxLfo: { ...lfo(), ...patch } });

  // The tabs: a press (not waiting for the release, as a key on a panel
  // goes down at once), a click from the keyboard, or the arrow keys
  // between them, open one.
  const tabs = [...head.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  // The tabs whose feature can be on, and when it is.
  // The Reverb's dot shows while its tab is open too (Jeremy, 2026-10-22):
  // its lamp says the reverb is on, wherever one is looking.
  const features: {
    tab: HTMLButtonElement | undefined;
    area: VoiceArea;
    name: string;
    on: () => boolean;
    whileOpen?: boolean;
  }[] = [
    {
      tab: tabs.find(tab => tab.dataset.tab === 'lfo'),
      area: 'lfo',
      name: 'LFO',
      on: () => lfoOn(lfo(), store.get().modWheel),
    },
    {
      tab: tabs.find(tab => tab.dataset.tab === 'pitch'),
      area: 'pitch',
      name: 'Pitch EG',
      on: () => pitchEnvelopeOn(store.get().dxPitchEnvelope),
    },
    {
      tab: tabs.find(tab => tab.dataset.tab === 'reverb'),
      area: 'reverb',
      name: 'Reverb',
      on: () => store.get().dxReverb.on,
      whileOpen: true,
    },
  ];
  let open: VoiceArea = 'algorithm';
  const showTabs = () => {
    for (const tab of tabs) {
      const on = tab.dataset.tab === open;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
      if (panel) panel.hidden = !on;
    }
    // A feature's dot, while it is on and its tab closed.
    for (const { tab, area, name, on, whileOpen } of features) {
      const marked = (whileOpen || open !== area) && on();
      tab?.classList.toggle('is-marked', marked);
      tab?.setAttribute('aria-label', marked ? `${name}, on` : name);
    }
    if (open === 'lfo') drawPlot();
  };
  const choose = (area: VoiceArea) => {
    if (open === area) return;
    open = area;
    showTabs();
    // The new picture on the glass, and the glass glitching over it.
    glitchScreens([document.getElementById(SCREENS[area]) as HTMLCanvasElement | null]);
  };
  tabs.forEach((tab, i) => {
    // The click that follows a press finds the tab open already.
    tab.addEventListener('pointerdown', event => {
      if (event.button === 0) choose(tab.dataset.tab as VoiceArea);
    });
    tab.addEventListener('click', () => choose(tab.dataset.tab as VoiceArea));
    tab.addEventListener('keydown', event => {
      const to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      const next = tabs[(to + tabs.length) % tabs.length];
      choose(next.dataset.tab as VoiceArea);
      next.focus();
    });
  });

  // The wave: six buttons as one radio group, the arrows moving the choice.
  const buttons = LFO_WAVES.map(wave => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lfo-wave';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-label', WAVES[wave].name);
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 16');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', WAVES[wave].path);
    svg.append(path);
    button.append(svg);
    // Chosen on the press, as the tabs are; the click after finds it chosen.
    const choose = () => {
      if (lfo().wave !== wave) setLfo({ wave });
    };
    button.addEventListener('pointerdown', event => {
      if (event.button === 0) choose();
    });
    button.addEventListener('click', choose);
    return button;
  });
  buttons.forEach((button, i) => {
    button.addEventListener('keydown', event => {
      const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
      if (step === undefined) return;
      event.preventDefault();
      const to = (i + step + buttons.length) % buttons.length;
      setLfo({ wave: LFO_WAVES[to] });
      buttons[to].focus();
    });
  });
  waves.replaceChildren(...buttons);

  // The six knobs. The delay and the vibratos can be off, at the bottom of
  // their log scales; the smallest above that is the DX7's first step. The
  // tremolos' too, the wheel's (Jeremy, 2026-10-21).
  const built = [
    createKnob({
      label: 'Speed',
      name: 'LFO speed',
      min: LFO_SPEED.min,
      max: LFO_SPEED.max,
      log: true,
      get: () => lfo().speed,
      set: value => setLfo({ speed: Number(value.toPrecision(3)) }),
      format: formatHz,
    }),
    createKnob({
      label: 'Delay',
      name: 'LFO delay',
      min: dx7LfoDelay(1),
      max: LFO_DELAY.max,
      log: true,
      zero: true,
      get: () => lfo().delay,
      set: value => setLfo({ delay: value === 0 ? 0 : Number(value.toPrecision(2)) }),
      format: formatTime,
    }),
    createKnob({
      label: 'Vibrato',
      name: 'Vibrato',
      min: dx7VibratoCents(1, 1),
      max: LFO_VIBRATO.max,
      log: true,
      zero: true,
      get: () => lfo().vibrato,
      set: value => setLfo({ vibrato: value === 0 ? 0 : Number(value.toPrecision(3)) }),
      format: formatCentsSwing,
    }),
    createKnob({
      label: 'Tremolo',
      name: 'Tremolo',
      min: LFO_TREMOLO.min,
      max: LFO_TREMOLO.max,
      get: () => lfo().tremolo,
      set: value => setLfo({ tremolo: Math.round(value * 10) / 10 }),
      format: formatPull,
    }),
    createKnob({
      label: 'Wh vib',
      name: 'Wheel vibrato',
      min: dx7VibratoCents(1, 1),
      max: LFO_VIBRATO.max,
      log: true,
      zero: true,
      get: () => lfo().wheelVibrato,
      set: value => setLfo({ wheelVibrato: value === 0 ? 0 : Number(value.toPrecision(3)) }),
      format: formatCentsSwing,
    }),
    createKnob({
      label: 'Wh trem',
      name: 'Wheel tremolo',
      min: dx7TremoloDb(1),
      max: LFO_TREMOLO.max,
      log: true,
      zero: true,
      get: () => lfo().wheelTremolo,
      set: value => setLfo({ wheelTremolo: value === 0 ? 0 : Number(value.toPrecision(2)) }),
      format: formatPull,
    }),
  ];
  knobs.replaceChildren(...built.map(knob => knob.element));

  // Key sync, a push key: it goes down or up on the press, as the tabs
  // change. Enter and Space work it through the click; a pointer's click
  // (detail 1 or more) follows a press that has already worked it.
  const flip = () => setLfo({ sync: !lfo().sync });
  sync.addEventListener('pointerdown', event => {
    if (event.button === 0) flip();
  });
  sync.addEventListener('click', event => {
    if (event.detail === 0) flip();
  });

  const drawPlot = () => {
    const now = lfo();
    const wheel = store.get().modWheel;
    drawLfo(plot, now, knobValues(plot, knobs), wheel);
    plot.setAttribute('aria-label', describeLfo(now, WAVES[now.wave].name, wheel));
  };

  const show = () => {
    const now = lfo();
    buttons.forEach((button, i) => {
      const on = LFO_WAVES[i] === now.wave;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    built.forEach(knob => knob.update());
    sync.setAttribute('aria-pressed', String(now.sync));
    showTabs();
  };

  store.subscribe((state, previous) => {
    // The tab stays as it was left (Jeremy, 2026-10-25): the synth comes
    // back as it was within a visit; a reload opens on Algorithm.
    if (state.chapter !== previous.chapter || state.dxLfo !== previous.dxLfo) show();
    else if (
      state.dxPitchEnvelope !== previous.dxPitchEnvelope ||
      state.modWheel !== previous.modWheel ||
      state.dxReverb.on !== previous.dxReverb.on
    ) {
      showTabs();
    }
    else if (state.theme !== previous.theme && open === 'lfo') drawPlot();
  });
  new ResizeObserver(() => {
    if (open === 'lfo') drawPlot();
  }).observe(plot);
  redrawOnLayout(knobs, () => {
    if (open === 'lfo') drawPlot();
  });
  show();
}
