// The keys held, from every source at once (Jeremy, 2026-10-23: MIDI In):
// the computer's keys, the pointer on the screen's keys, and each MIDI
// input. A pitch sounds while anything holds it: it goes into the store's
// `held` with its first holder and comes out with its last. The sustain
// pedal (MIDI's CC64) keeps MIDI notes let go sounding until it is lifted.
// `KeyHolders` is the counting alone, pure, for the tests; `createKeyBed`
// keeps the store's `held` and the figures' note with it.

import { midiToHz } from '../dsp/voices';
import { type LabStore, releaseSecondsOf } from '../model/lab';

/** Who holds a key: the computer's keys, the pointer, or a MIDI input by its id. */
export type Holder = 'key' | 'pointer' | `midi:${string}`;

/** Whether a holder is a MIDI input's. */
export const isMidi = (holder: Holder) => holder.startsWith('midi:');

/** What a press or a release did to the pitch: whether it went into `held` or came out. */
export interface Change {
  entered: boolean;
  left: boolean;
}

export class KeyHolders {
  private readonly holders = new Map<number, Set<Holder>>();
  /** Pitches let go of while the pedal was down, kept sounding, and the input whose pedal kept them. */
  private readonly sustained = new Map<number, string>();
  /** The inputs whose pedal is down. */
  private readonly pedals = new Set<string>();
  /** The pitches sounding, in the order they went in. */
  private readonly order: number[] = [];

  /** The pitches held or sustained, in the order they went in. */
  held(): number[] {
    return [...this.order];
  }

  /** Whether `pitch` is sounding (held or sustained). */
  has(pitch: number): boolean {
    return this.order.includes(pitch);
  }

  /** Whether anything still holds `pitch` (sustain apart). */
  holds(pitch: number): boolean {
    return (this.holders.get(pitch)?.size ?? 0) > 0;
  }

  /** `holder` holds `pitch`. A sustained pitch played again is held anew. */
  press(pitch: number, holder: Holder): Change {
    const entered = !this.has(pitch);
    let set = this.holders.get(pitch);
    if (!set) this.holders.set(pitch, (set = new Set()));
    set.add(holder);
    this.sustained.delete(pitch);
    if (entered) this.order.push(pitch);
    return { entered, left: false };
  }

  /**
   * `holder` lets `pitch` go. With nothing else holding it, it comes out,
   * unless it is MIDI's and a pedal is down: then it is sustained.
   */
  release(pitch: number, holder: Holder): Change {
    const set = this.holders.get(pitch);
    if (!set?.delete(holder)) return { entered: false, left: false };
    if (set.size > 0) return { entered: false, left: false };
    this.holders.delete(pitch);
    if (isMidi(holder) && this.pedals.size > 0) {
      this.sustained.set(pitch, holder.slice(5));
      return { entered: false, left: false };
    }
    this.drop(pitch);
    return { entered: false, left: true };
  }

  /** `input`'s pedal goes down or up. Lifted, with no other pedal down, the sustained pitches nothing holds come out. */
  pedal(input: string, down: boolean): number[] {
    if (down) {
      this.pedals.add(input);
      return [];
    }
    this.pedals.delete(input);
    if (this.pedals.size > 0) return [];
    const out = [...this.sustained.keys()].filter(pitch => !this.holds(pitch));
    for (const pitch of out) this.drop(pitch);
    this.sustained.clear();
    return out;
  }

  /**
   * Lets go everything `test` says of its holders (the window blurred:
   * the computer's and the pointer's; an input unplugged: its own): the
   * pitches that come out. With `pedalOf`, that input's pedal is lifted
   * too, and what it alone kept comes out.
   */
  releaseWhere(test: (holder: Holder) => boolean, pedalOf?: string): number[] {
    const out: number[] = [];
    for (const [pitch, set] of [...this.holders]) {
      for (const holder of [...set]) if (test(holder)) set.delete(holder);
      if (set.size === 0) {
        this.holders.delete(pitch);
        this.drop(pitch);
        out.push(pitch);
      }
    }
    if (pedalOf !== undefined) {
      this.pedals.delete(pedalOf);
      for (const [pitch, input] of [...this.sustained]) {
        if (input === pedalOf || this.pedals.size === 0) {
          this.drop(pitch);
          out.push(pitch);
        }
      }
    }
    return out;
  }

  /** Every MIDI holder and every pedal let go, as MIDI switched off or the sandbox left: the pitches that come out. */
  releaseMidi(): number[] {
    const out = this.releaseWhere(isMidi);
    this.pedals.clear();
    for (const pitch of [...this.sustained.keys()]) {
      if (!this.holds(pitch)) {
        this.drop(pitch);
        out.push(pitch);
      }
    }
    this.sustained.clear();
    return out;
  }

  /** Everything let go at once, as Stop: nothing sounds after. */
  clear(): void {
    this.holders.clear();
    this.sustained.clear();
    this.pedals.clear();
    this.order.length = 0;
  }

  private drop(pitch: number): void {
    this.sustained.delete(pitch);
    const at = this.order.indexOf(pitch);
    if (at !== -1) this.order.splice(at, 1);
  }
}

/** Now, on the page's clock, in seconds. */
const now = () => performance.now() / 1000;

/** The key bed the piano and MIDI share: the holders, and the store kept with them. */
export interface KeyBed {
  /** `holder` holds `midi`. Returns what that did. */
  press(midi: number, holder: Holder): Change;
  /** `holder` lets `midi` go. */
  release(midi: number, holder: Holder): Change;
  /** `input`'s pedal; returns the pitches let go by its lifting. */
  pedal(input: string, down: boolean): number[];
  /** Lets go what `test` says (blur: the computer's and the pointer's; an input unplugged). */
  releaseWhere(test: (holder: Holder) => boolean, pedalOf?: string): number[];
  /** Every MIDI note and pedal let go. */
  releaseMidi(): number[];
  /** Whether `midi` is sounding. */
  has(midi: number): boolean;
  /** Called after every change, to draw the keys. */
  onChange(listener: () => void): void;
}

/**
 * The key bed over the store: `held` follows it, and the figures follow
 * the note struck last from any source (its pitch the carrier's, its
 * moment the note's; its length known once it is let go).
 */
export function createKeyBed(store: LabStore): KeyBed {
  const holders = new KeyHolders();
  const listeners: (() => void)[] = [];
  /** The pitch struck last, which the figures follow; null once let go. */
  let last: number | null = null;

  const changed = (left: readonly number[]) => {
    const { noteStartedAt } = store.get();
    if (last !== null && left.includes(last) && noteStartedAt !== null) {
      // The note the figures follow is let go: now its length is known.
      last = null;
      const hold = Math.max(0, now() - noteStartedAt);
      store.set({ held: holders.held(), noteHold: hold, noteLength: hold + releaseSecondsOf(store.get()) });
    } else {
      store.set({ held: holders.held() });
    }
    for (const listener of listeners) listener();
  };

  // Stop (the space bar): every voice is silenced, so nothing is held.
  store.subscribe((state, previous) => {
    if (state.stops !== previous.stops && holders.held().length > 0) {
      holders.clear();
      last = null;
      store.set({ held: [] });
      for (const listener of listeners) listener();
    }
  });

  return {
    press(midi, holder) {
      const change = holders.press(midi, holder);
      // A new strike from MIDI (a note played again, sustained or held by
      // another source) is the figures' new note too.
      if (change.entered || isMidi(holder)) {
        last = midi;
        // Inside the key press, so the engine may start audio. Held for as
        // long as the key is: the note's length is not known yet.
        store.set({
          held: holders.held(),
          carrierHz: midiToHz(midi),
          noteStartedAt: now(),
          noteLength: Infinity,
          noteHold: Infinity,
        });
        for (const listener of listeners) listener();
      }
      return change;
    },
    release(midi, holder) {
      const change = holders.release(midi, holder);
      if (change.left) changed([midi]);
      return change;
    },
    pedal(input, down) {
      const out = holders.pedal(input, down);
      if (out.length > 0) changed(out);
      return out;
    },
    releaseWhere(test, pedalOf) {
      const out = holders.releaseWhere(test, pedalOf);
      if (out.length > 0) changed(out);
      return out;
    },
    releaseMidi() {
      const out = holders.releaseMidi();
      if (out.length > 0) changed(out);
      return out;
    },
    has: midi => holders.has(midi),
    onChange: listener => listeners.push(listener),
  };
}
