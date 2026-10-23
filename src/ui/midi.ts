// MIDI In (Jeremy, 2026-10-23): a USB MIDI keyboard plays the sandbox.
// The keyboard panel's third column, MIDI, has one lamp key, In, which
// turns it on and off (the `midi` setting, kept between visits). On, every
// input the Input setting names is listened to (all by default), on the
// Channel set: notes, the sustain pedal, the mod wheel, the pitch wheel
// and all-off; nothing else. Notes go to the sound first (the engine's
// `noteOn`), then to the key bed with the other sources. Velocity is
// carried, not yet heard.

import { midiToHz } from '../dsp/voices';
import type { LabStore } from '../model/lab';
import { settings } from '../model/settings';
import { createStore } from '../model/store';
import type { KeyBed } from './keyBed';
import { parseMidi } from './midiMessage';
import { tapeLabel } from './dymo';

/** The inputs connected, by name, for the Settings panel's Input line. */
export const midiInputs = createStore<{ names: string[] }>({ names: [] });

/**
 * What the In key shows: MIDI off, on, asking the browser (its permission
 * prompt open, or the answer not back yet), waiting for a gesture,
 * blocked, or not in this browser.
 */
export type MidiState = 'off' | 'on' | 'asking' | 'waiting' | 'blocked' | 'unsupported';

/** The key's tip and description for a state, and the inputs' names. */
export function midiTip(state: MidiState, names: readonly string[]): string {
  if (state === 'unsupported') return 'This browser has no MIDI: use Chrome, Edge, Brave or Firefox';
  if (state === 'blocked') {
    return "MIDI blocked: allow it in the site's settings (in Brave: Settings, Site and Shields settings, MIDI devices)";
  }
  if (state === 'asking') return 'MIDI: asking the browser; allow it in the prompt by the address bar';
  if (state === 'waiting') return 'Click anywhere to wake the sound';
  if (state === 'off') return 'MIDI off';
  return names.length > 0 ? `MIDI on: ${names.join(', ')}` : 'MIDI on: no keyboard connected';
}

/** What the engine does for a MIDI note: sound it now (false: it could not, before the page's first gesture). */
interface Sound {
  noteOn(note: number, hz: number, velocity: number, marks: boolean): boolean;
}

/**
 * Builds the MIDI column in the keyboard's control `panel`, and listens
 * while `active()` says the sandbox is showing.
 */
export function mountMidi(panel: HTMLElement, store: LabStore, sound: Sound, bed: KeyBed, active: () => boolean): void {
  const tape = document.createElement('span');
  tape.className = 'midi-label';
  tape.textContent = 'MIDI';
  tape.setAttribute('aria-hidden', 'true');
  const bezel = document.createElement('span');
  bezel.className = 'lamp-keys midi-bezel';
  const key = document.createElement('button');
  key.type = 'button';
  key.className = 'lamp-key midi-in';
  key.textContent = 'In';
  key.setAttribute('aria-label', 'MIDI in');
  key.setAttribute('aria-pressed', 'false');
  bezel.append(key);
  panel.append(tape, bezel);
  tapeLabel(tape);

  const supported = typeof navigator.requestMIDIAccess === 'function';
  let access: MIDIAccess | null = null;
  let blocked = false;
  /** Whether a request is out, its answer not back. */
  let asking = false;
  /** Whether the first message has been logged. */
  let heardAny = false;
  /** Whether the page has had a gesture: until then no sound can start. */
  let woken = navigator.userActivation?.hasBeenActive ?? false;
  /** The inputs listened to, by id. */
  const attached = new Map<string, MIDIInput>();

  const state = (): MidiState => {
    if (!supported) return 'unsupported';
    if (settings.get().midi !== 'on') return 'off';
    if (blocked) return 'blocked';
    if (asking) return 'asking';
    if (!woken) return 'waiting';
    return 'on';
  };
  const show = () => {
    const now = state();
    const names = access ? [...access.inputs.values()].filter(input => input.state === 'connected').map(input => input.name ?? '') : [];
    midiInputs.set({ names });
    const listened = [...attached.values()].map(input => input.name ?? '');
    const tip = midiTip(now, listened);
    key.title = tip;
    key.setAttribute('aria-description', tip);
    key.setAttribute('aria-pressed', String(now === 'on' || now === 'waiting' || now === 'asking'));
    key.dataset.state = now;
    key.disabled = now === 'unsupported';
  };

  /** Whether an input is the one the Input setting names (all, when it names none). */
  const wanted = (input: MIDIInput) => {
    const name = settings.get().midiInput;
    return input.state === 'connected' && (name === '' || input.name === name);
  };

  /** An input's notes and pedal let go (unplugged, or no longer listened to). */
  const letGo = (id: string) => {
    bed.releaseWhere(holder => holder === `midi:${id}`, id);
  };

  const attach = () => {
    if (!access) return;
    for (const [id, input] of [...attached]) {
      if (!wanted(input)) {
        input.onmidimessage = null;
        attached.delete(id);
        letGo(id);
      }
    }
    for (const input of access.inputs.values()) {
      if (wanted(input) && !attached.has(input.id)) {
        attached.set(input.id, input);
        console.info(`fmlab: MIDI listening to "${input.name ?? input.id}"`);
        input.onmidimessage = event => hear(input.id, event.data);
      }
    }
    show();
  };

  /** Everything MIDI let go: its notes, its pedal, the bend back to the middle. The mod wheel stays. */
  const silence = () => {
    bed.releaseMidi();
    if (store.get().pitchBend !== 0) store.set({ pitchBend: 0 });
  };

  const detach = () => {
    for (const input of attached.values()) input.onmidimessage = null;
    attached.clear();
    silence();
    show();
  };

  // Asked inside the press itself (a gesture), so no browser drops the
  // prompt; on load too, with MIDI saved on.
  const request = () => {
    if (!supported || asking) return;
    asking = true;
    console.info('fmlab: MIDI requesting access');
    // No sysex: that brings a stronger prompt.
    navigator.requestMIDIAccess().then(
      granted => {
        asking = false;
        access = granted;
        blocked = false;
        const names = [...granted.inputs.values()].map(input => input.name ?? input.id);
        console.info(`fmlab: MIDI granted, ${names.length} input(s)${names.length > 0 ? `: ${names.join(', ')}` : ''}`);
        granted.onstatechange = () => attach();
        attach();
      },
      (error: unknown) => {
        // Refused: tried again on the next press, and the next visit.
        asking = false;
        blocked = true;
        const why = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        console.warn(`fmlab: MIDI refused (${why})`);
        show();
      },
    );
    show();
  };

  /** A message from input `id`. */
  const hear = (id: string, data: Uint8Array | null) => {
    if (!data || !active() || settings.get().midi !== 'on') return;
    if (!heardAny) {
      heardAny = true;
      console.info(`fmlab: MIDI first message from "${attached.get(id)?.name ?? id}": ${[...data].join(' ')}`);
    }
    const event = parseMidi(data, settings.get().midiChannel);
    if (!event) return;
    const holder = `midi:${id}` as const;
    switch (event.type) {
      case 'noteOn': {
        // The sound first, then the store; dropped before the first gesture.
        const entering = !bed.has(event.note);
        if (!sound.noteOn(event.note, midiToHz(event.note), event.velocity, entering)) return;
        bed.press(event.note, holder);
        break;
      }
      case 'noteOff':
        bed.release(event.note, holder);
        break;
      case 'pedal':
        bed.pedal(id, event.down);
        break;
      case 'wheel':
        if (store.get().modWheel !== event.amount) store.set({ modWheel: event.amount });
        break;
      case 'bend':
        store.set({ pitchBend: event.amount });
        break;
      case 'allOff':
        store.set({ stops: store.get().stops + 1, noteStartedAt: null });
        break;
    }
  };

  // In, worked on the press: on asks for MIDI (and, as a gesture, wakes
  // the sound); off lets it all go. Blocked, a press asks again.
  const press = () => {
    console.info(`fmlab: MIDI In pressed (${state()})`);
    if (!supported) return;
    if (settings.get().midi === 'on' && !blocked) {
      settings.set({ midi: 'off' });
      return;
    }
    if (settings.get().midi !== 'on') settings.set({ midi: 'on' });
    // Inside the press, not after it: the setting's subscriber asks too,
    // but a press while blocked changes no setting.
    if (!access) request();
  };
  key.addEventListener('pointerdown', event => {
    if (event.button === 0) press();
  });
  key.addEventListener('click', event => {
    if (event.detail === 0) press();
  });

  // The page's first gesture: from then a note can sound.
  const wake = () => {
    if (woken) return;
    woken = true;
    show();
  };
  for (const type of ['pointerdown', 'keydown', 'touchend']) {
    document.addEventListener(type, wake, { capture: true, passive: true });
  }

  settings.subscribe((now, before) => {
    if (now.midi !== before.midi) {
      if (now.midi === 'on') {
        if (access) attach();
        else request();
      } else {
        detach();
      }
    }
    if (now.midiInput !== before.midiInput && now.midi === 'on') attach();
    show();
  });
  // Leaving the sandbox lets MIDI's notes go; MIDI stays on, so coming back plays.
  store.subscribe((state, previous) => {
    if (state.chapter !== previous.chapter && !active()) silence();
  });

  if (supported && settings.get().midi === 'on') request();
  show();
}
