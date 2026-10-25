import { type Envelope, noteSeconds, TIME_CONSTANTS } from '../dsp/envelope';
import { DEFAULT_VELOCITY, dx7NoteHold } from '../dsp/dx7';
import { noteHold } from '../dsp/operators';
import type { VoiceMessage, VoicePatch } from '../dsp/voicePool';
import { midiToHz } from '../dsp/voices';
import {
  envelopeOf,
  type LabState,
  type LabStore,
  noteSounding,
  releaseSecondsOf,
} from '../model/lab';
import type { ReverbMessage } from '../dsp/plateReverb';
import { settings } from '../model/settings';
import type { Measurement } from '../viz/liveSpectrum';
import { unlockIosAudio } from './iosUnlock';
import { PROCESSOR_NAME } from './processorName';
// `?worker&url` has Vite compile the worklet and its imports into a file
// of its own and hand back the address.
import processorUrl from './synthProcessor.ts?worker&url';

/** A parameter glides to a new value over this long: no zipper noise. */
const GLIDE_SECONDS = 0.03;
/** Time constant of the fade when sound starts and stops: no click. */
const FADE_SECONDS = 0.02;
/** After Stop, the fade gets this long before the context is suspended. */
const SUSPEND_AFTER_MS = 250;
/**
 * How long the sandbox's context stays running in silence before it is
 * suspended. Resuming a suspended context switches the audio output back
 * on, which delays the next note by the better part of 100 ms, so
 * between notes the sandbox keeps it running; an idle voice pool costs
 * little.
 */
const SANDBOX_IDLE_MS = 60_000;
/** Between chapters, the fade-out gets this long before the patch jumps. */
const SCENE_GAP_MS = 100;
/**
 * A note starts this long after it is asked for. In that time whatever
 * was sounding is brought down to nothing, so the new note starts from
 * silence without a click.
 */
export const NOTE_LEAD_SECONDS = 0.02;
/** Time constant of that bringing down: gone well inside the lead. */
const DIP_SECONDS = 0.003;
/**
 * The voice Play note and the space bar strike, six operators: not a key
 * on the keyboard (those are MIDI numbers, 0 to 127).
 */
export const PLAYED_NOTE = 128;

/** What every note of six operators is struck with, from the state. */
export function voicePatch(state: LabState): VoicePatch {
  return state.voiceModel === 'dx7'
    ? {
        kind: 'dx7',
        algorithm: state.algorithm,
        feedback: state.dxFeedback,
        operators: state.dxOperators,
        lfo: state.dxLfo,
        pitchEnvelope: state.dxPitchEnvelope,
      }
    : { algorithm: state.algorithm, feedback: state.feedback, operators: state.operators };
}

/** How long Play note holds a note of six operators. */
export function playedHold(state: LabState): number {
  return state.voiceModel === 'dx7'
    ? dx7NoteHold(state.algorithm, state.dxOperators)
    : noteHold(state.operators);
}

/** The nodes, once there is a context. */
interface Graph {
  context: AudioContext;
  synth: AudioWorkletNode;
  /** The envelope's loudness, for a chapter that plays notes; else 1. */
  note: GainNode;
  /**
   * The same, on the worklet's second output, the dry sound alone (no
   * reverb), which the analyser measures: every change to `note` is made
   * to it too.
   */
  noteDry: GainNode;
  master: GainNode;
  /** Measures the spectrum for the live view, before the volume. */
  analyser: AnalyserNode;
  /** A scratch buffer for `measure()`. */
  bins: Float32Array<ArrayBuffer>;
}

/**
 * The live view's FFT: 8192 samples is about a sixth of a second, and
 * bins about 6 Hz apart, fine enough to part the sidebands of a 55 Hz
 * modulator.
 */
const FFT_SIZE = 8192;

/**
 * Plays the model: it follows the store and owns everything Web Audio.
 *
 *   worklet (the synth, stereo) -> note gain -> master gain -> limiter -> speakers
 *   worklet (its dry output) -> note gain (the same) -> analyser (the live spectrum)
 *
 * The first output carries the sandbox's plate reverb when it is on (a
 * Setting; dsp/plateReverb.ts), the second the dry sound alone, so the
 * spectrum is the notes, never the tail.
 *
 * There are three ways of playing. Most chapters hold one steady sound
 * while `playing` is true. A chapter in `noteMode` plays one note each
 * time `notes` changes, its loudness (the note gain) and its index shaped
 * by the envelope. Six operators (`ops`) play notes too, several at once,
 * in the worklet's voice pool: the engine tells it which keys are down
 * (`held`) and which note Play note strikes, and the pool shapes them.
 *
 * Audio can only start inside a click or key press: browsers refuse
 * otherwise. Most pages create nothing until the first sound is asked
 * for. The sandbox builds the graph on arrival instead (`warm`), its
 * context left suspended, so that its first key need only resume it:
 * loading the worklet takes the better part of 100 ms, which the first
 * note used to wait for.
 */
export class AudioEngine {
  private graph: Graph | null = null;
  private loading: Promise<Graph> | null = null;
  /** Looping silence that keeps iOS from muting us; see iosUnlock.ts. */
  private silence: HTMLAudioElement | null = null;
  /** Whether the iOS unlock has been done, in the first gesture. */
  private unlocked = false;
  /** Whether the sandbox's gestures are being listened for (`prime`). */
  private listening = false;
  private suspendTimer: number | undefined;
  private sceneTimer: number | undefined;
  /** True while faded out between two chapters' patches. */
  private changingScene = false;
  /** Messages to the voice pool, in the order they were asked for. */
  private voiceQueue: Promise<void> = Promise.resolve();
  /** How many of them are still on their way: a note sent at once must not pass one. */
  private pending = 0;
  /**
   * Whether the pool has the current patch, the wheel and the bend: then a
   * note needs only its noteOn, not the whole patch again (a chord would
   * otherwise post four).
   */
  private poolCurrent = false;
  /** Whether a note can sound at once: the six operators' mode set and the volume up since the last hush. */
  private voiceReady = false;
  /**
   * Notes a MIDI key sent straight to the pool (`noteOn`): the store's
   * `held` follows a moment later, and must not strike them again.
   */
  private readonly sent = new Set<number>();
  /** Whether the page has had a click, tap or key press: until then no sound can start. */
  private gestured = false;
  /** Whether the audio latency has been logged, once, on the first MIDI note. */
  private latencyLogged = false;

  constructor(private readonly store: LabStore) {
    if (store.get().chapter === 'sandbox') this.warm();
    // The reverb follows its settings, and is off outside the sandbox.
    settings.subscribe((now, before) => {
      if (
        now.reverb !== before.reverb ||
        now.reverbDecay !== before.reverbDecay ||
        now.reverbMix !== before.reverbMix ||
        now.reverbTone !== before.reverbTone ||
        now.reverbPreDelay !== before.reverbPreDelay
      ) {
        this.tell(this.reverbMessage());
      }
      // A new Bend range re-sends the bend; MIDI off lets the context rest again.
      if (now.bendRange !== before.bendRange) this.tell(this.bendMessage());
      if (now.midi !== before.midi && now.midi === 'off') this.suspendSoon(SUSPEND_AFTER_MS);
    });
    store.subscribe((state, previous) => {
      if (state.chapter !== previous.chapter) this.tell(this.reverbMessage());
      if (state.chapter === 'sandbox' && previous.chapter !== 'sandbox') this.warm();
      if (state.mode === 'ops' && this.followVoices(state, previous)) return;
      // Out of six operators: whatever they were playing stops.
      if (previous.mode === 'ops' && state.mode !== 'ops') this.tell({ type: 'allOff' });
      if (state.notes !== previous.notes) {
        void this.playNote();
      } else if (state.stops !== previous.stops) {
        // A note stopped before its end.
        this.hush();
        this.suspendSoon(SUSPEND_AFTER_MS);
      } else if (state.playing !== previous.playing) {
        if (state.playing) void this.start();
        else this.stop();
      } else if (state.playing) {
        // A new chapter, or switching chapter 9 between PM and FM: fade
        // through the change rather than click.
        if (state.chapter !== previous.chapter || state.mode !== previous.mode) {
          this.changeScene();
        }
        else if (!this.changingScene) this.sendPatch(state, GLIDE_SECONDS);
      } else if (state.chapter !== previous.chapter) {
        // A note may still be ringing from the chapter left behind.
        this.hush();
      } else if (state.noteMode) {
        this.tuneNote(state);
      }
    });
  }

  /**
   * Six operators: keys struck and let go, Play note, Stop, a new chapter
   * and the patch, all told to the voice pool. Returns whether that was
   * all that changed that matters here.
   */
  private followVoices(state: LabState, previous: LabState): boolean {
    if (state.chapter !== previous.chapter || state.stops !== previous.stops) {
      // A note may still be ringing from the chapter left behind, too.
      if (state.chapter !== previous.chapter) this.hush();
      this.tell({ type: 'allOff' });
      this.suspendSoon(SUSPEND_AFTER_MS);
    }
    if (state.held !== previous.held) {
      for (const note of state.held) {
        if (previous.held.includes(note)) continue;
        // A MIDI note has been sent already (`noteOn`): not struck twice.
        if (this.sent.delete(note)) continue;
        // A key's velocity: the key bed set it with `held` (Key velocity).
        this.strike(note, midiToHz(note), Infinity, undefined, state.noteVelocity);
      }
      for (const note of previous.held) {
        if (!state.held.includes(note)) this.tell({ type: 'noteOff', note });
      }
      // Not before the reverb's tail has rung out.
      if (state.held.length === 0) this.suspendSoon((releaseSecondsOf(state) + 1) * 1000 + this.tailMs());
    }
    if (state.notes !== previous.notes) {
      // Play note, or the space bar: held as long as the slowest
      // operator needs, then let go, as chapter 8's notes always were.
      const hold = playedHold(state);
      const seconds = hold + releaseSecondsOf(state);
      this.strike(PLAYED_NOTE, state.carrierHz, hold, () => {
        this.store.set({
          noteStartedAt: performance.now() / 1000,
          noteLength: seconds,
          noteHold: hold,
          noteVelocity: DEFAULT_VELOCITY,
        });
        this.suspendSoon((seconds + 1) * 1000 + this.tailMs());
      });
    }
    if (
      state.algorithm !== previous.algorithm ||
      state.feedback !== previous.feedback ||
      state.operators !== previous.operators ||
      state.voiceModel !== previous.voiceModel ||
      state.dxFeedback !== previous.dxFeedback ||
      state.dxOperators !== previous.dxOperators ||
      state.dxLfo !== previous.dxLfo ||
      state.dxPitchEnvelope !== previous.dxPitchEnvelope
    ) {
      // Taken up by the next note struck, the LFO at once; and an edit
      // from the sandbox's controls by the notes sounding too (not a
      // preset or a link: a new voice). The algorithm only ever reaches
      // the next note.
      const live =
        state.voiceModel === 'dx7' &&
        previous.voiceModel === 'dx7' &&
        state.chapter === previous.chapter &&
        state.voiceLoads === previous.voiceLoads;
      this.tell({ type: 'patch', patch: voicePatch(state), live });
    }
    // The wheel on its own, lighter than the whole patch at every step of a drag.
    if (state.modWheel !== previous.modWheel) this.tell({ type: 'wheel', amount: state.modWheel });
    if (state.pitchBend !== previous.pitchBend) this.tell(this.bendMessage());
    if (state.volume !== previous.volume) this.tuneNote(state);
    return true;
  }

  /** The pitch wheel as the pool takes it: semitones, its position times the Bend range. */
  private bendMessage(): VoiceMessage {
    return { type: 'bend', semitones: this.store.get().pitchBend * settings.get().bendRange };
  }

  /**
   * A MIDI key down (ui/midi.ts; Jeremy, 2026-10-23): the sound first,
   * before the store hears of it. Straight to the pool when it is running
   * and has the patch; otherwise struck as a key is (waking the context).
   * `marks`: the note goes into `held` next, which must not strike it
   * again (a note played again while it sounds does not). False until the
   * page's first gesture, when no sound can start: the note is dropped.
   */
  noteOn(note: number, hz: number, velocity: number, marks: boolean): boolean {
    if (!this.gestured && !(navigator.userActivation?.hasBeenActive ?? false)) return false;
    if (marks) this.sent.add(note);
    const graph = this.graph;
    if (graph && graph.context.state === 'running' && this.voiceReady && this.poolCurrent && this.pending === 0) {
      graph.synth.port.postMessage({ type: 'noteOn', note, hz, hold: Infinity, velocity } satisfies VoiceMessage);
    } else {
      this.strike(note, hz, Infinity, undefined, velocity);
    }
    if (!this.latencyLogged && graph) {
      this.latencyLogged = true;
      const { baseLatency, outputLatency } = graph.context;
      console.info(
        `fmlab: audio latency ${(baseLatency * 1000).toFixed(1)} ms base, ${((outputLatency ?? 0) * 1000).toFixed(1)} ms output`,
      );
    }
    return true;
  }

  /** Whether MIDI keeps the context running: on, in the sandbox. */
  private midiOn(): boolean {
    return settings.get().midi === 'on' && this.store.get().chapter === 'sandbox';
  }

  /**
   * Strikes a note in the voice pool. Called inside the key press, so the
   * engine may start audio. The patch, the wheel and the bend go with it
   * when the pool does not have them yet.
   */
  private strike(note: number, hz: number, hold: number, started?: () => void, velocity?: number): void {
    const ready = this.wake();
    this.pending++;
    this.voiceQueue = this.voiceQueue
      .then(async () => {
        const { context, synth, note: noteGain, noteDry, master } = await ready;
        const state = this.store.get();
        if (state.mode !== 'ops') return;
        const now = context.currentTime;
        synth.parameters.get('mode')?.setValueAtTime(2, now);
        for (const gain of [noteGain.gain, noteDry.gain]) {
          gain.cancelScheduledValues(now);
          gain.setValueAtTime(1, now);
        }
        // Straight to the volume, not faded in: the note's own envelope
        // starts from silence, and a fade would soften its attack.
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(state.volume, now);
        if (!this.poolCurrent) {
          synth.port.postMessage({ type: 'patch', patch: voicePatch(state) } satisfies VoiceMessage);
          synth.port.postMessage({ type: 'wheel', amount: state.modWheel } satisfies VoiceMessage);
          synth.port.postMessage(this.bendMessage());
          this.poolCurrent = true;
        }
        synth.port.postMessage({ type: 'noteOn', note, hz, hold, velocity } satisfies VoiceMessage);
        this.voiceReady = true;
        started?.();
      })
      .catch(error => {
        console.error('fmlab: audio failed to start', error);
        this.loading = null;
      })
      .finally(() => this.pending--);
  }

  /** Tells the worklet something (the voice pool, the reverb), once there is one; never starts audio. */
  private tell(message: VoiceMessage | ReverbMessage): void {
    const loading = this.loading;
    if (!loading) return;
    this.pending++;
    this.voiceQueue = this.voiceQueue
      .then(async () => (await loading).synth.port.postMessage(message))
      .catch(() => {})
      .finally(() => this.pending--);
  }

  /**
   * A new chapter is a new patch, perhaps in the other mode: gliding there
   * would be a swoop, and jumping a click. So fade out, jump while silent,
   * and fade back in.
   */
  private changeScene(): void {
    const graph = this.graph;
    if (!graph) return;
    const { context, master } = graph;
    master.gain.setTargetAtTime(0, context.currentTime, FADE_SECONDS);
    window.clearTimeout(this.sceneTimer);
    this.changingScene = true;
    this.sceneTimer = window.setTimeout(() => {
      this.changingScene = false;
      const state = this.store.get();
      if (!state.playing) return;
      this.sendPatch(state, 0);
      master.gain.setTargetAtTime(state.volume, context.currentTime, FADE_SECONDS);
    }, SCENE_GAP_MS);
  }

  /**
   * The graph, running. Has to be called first thing inside the user's
   * gesture: the iOS unlock, the context (inside load) and the silent
   * element's play() all need it.
   */
  private async wake(): Promise<Graph> {
    window.clearTimeout(this.suspendTimer);
    if (!this.unlocked) {
      this.unlocked = true;
      this.silence = unlockIosAudio();
    }
    this.loading ??= this.load();
    void this.silence?.play().catch(() => {});
    const graph = await this.loading;
    await graph.context.resume();
    return graph;
  }

  /**
   * Builds the graph ahead of the first sound, outside any gesture: the
   * context starts suspended (or is suspended again soon, where the
   * browser lets it run), and the first key's `wake` resumes it.
   */
  private warm(): void {
    this.listen();
    if (this.loading) return;
    this.loading = this.load();
    this.loading.then(
      () => this.suspendSoon(SUSPEND_AFTER_MS),
      () => {
        this.loading = null;
      },
    );
  }

  /**
   * In the sandbox, any click, tap or key press resumes the built context
   * (Jeremy, 2026-10-20): the browser switches the audio output on, which
   * it only does in a gesture and which takes the better part of 100 ms,
   * before a key needs it. It plays nothing and leaves the event alone;
   * the context is suspended again after a minute's silence
   * (`SANDBOX_IDLE_MS`), and the next gesture resumes it.
   */
  private listen(): void {
    if (this.listening) return;
    this.listening = true;
    const prime = () => {
      this.gestured = true;
      if (this.store.get().chapter !== 'sandbox') return;
      const graph = this.graph;
      if (!graph || graph.context.state === 'running') return;
      if (!this.unlocked) {
        this.unlocked = true;
        this.silence = unlockIosAudio();
      }
      void this.silence?.play().catch(() => {});
      graph.context.resume().then(
        () => this.suspendSoon(SUSPEND_AFTER_MS),
        () => {},
      );
    };
    for (const type of ['pointerdown', 'keydown', 'touchend']) {
      document.addEventListener(type, prime, { capture: true, passive: true });
    }
  }

  private async start(): Promise<void> {
    try {
      const graph = await this.wake();
      // Stop may have been pressed while the worklet was loading.
      if (!this.store.get().playing) return;

      const state = this.store.get();
      // Jump to the patch while silent, then fade in.
      this.sendPatch(state, 0);
      graph.master.gain.setTargetAtTime(
        state.volume,
        graph.context.currentTime,
        FADE_SECONDS,
      );
    } catch (error) {
      console.error('fmlab: audio failed to start', error);
      this.loading = null;
      this.store.set({ playing: false });
    }
  }

  private stop(): void {
    window.clearTimeout(this.sceneTimer);
    this.changingScene = false;
    this.silence?.pause();
    this.hush();
    this.suspendSoon(SUSPEND_AFTER_MS);
  }

  /** Fades whatever is sounding to nothing. */
  private hush(): void {
    // Faded out: the next note must set the volume again.
    this.voiceReady = false;
    if (!this.graph) return;
    const { context, master } = this.graph;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0, context.currentTime, FADE_SECONDS);
  }

  /**
   * Suspends the context after `ms`, unless sound has been asked for
   * again by then. A suspended context costs nothing; a silent running
   * one still computes every sample.
   */
  private suspendSoon(ms: number): void {
    const graph = this.graph;
    if (!graph) return;
    // With MIDI on in the sandbox, never: resuming takes the better part
    // of 100 ms, which would land on the first note after a pause.
    if (this.midiOn()) {
      window.clearTimeout(this.suspendTimer);
      return;
    }
    if (this.store.get().chapter === 'sandbox') ms = Math.max(ms, SANDBOX_IDLE_MS);
    window.clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      const state = this.store.get();
      const quiet =
        !state.playing &&
        state.held.length === 0 &&
        !noteSounding(state, performance.now() / 1000);
      if (quiet) void graph.context.suspend();
    }, ms);
  }

  /**
   * Plays one note of a two-operator patch: its loudness and, if the patch
   * says so, its index following the envelope. The curves scheduled here
   * are the ones dsp/envelope.ts describes, which the figures draw.
   */
  private async playNote(): Promise<void> {
    try {
      const { context, synth, note, noteDry, master } = await this.wake();
      const state = this.store.get();
      if (!state.noteMode) return;

      const envelope = envelopeOf(state);
      const now = context.currentTime;
      const start = now + NOTE_LEAD_SECONDS;

      /** Schedules an envelope on a param, scaled to reach `peak`. */
      const shape = (param: AudioParam, peak: number, shaped: Envelope = envelope) => {
        const { attack, decay, sustain, release, hold } = shaped;
        param.cancelScheduledValues(now);
        param.setTargetAtTime(0, now, DIP_SECONDS);
        param.setValueAtTime(0, start);
        if (hold <= attack) {
          // Let go before the attack is over: release from part way up.
          param.linearRampToValueAtTime((peak * hold) / attack, start + hold);
        } else {
          param.linearRampToValueAtTime(peak, start + attack);
          param.setTargetAtTime(
            peak * sustain,
            start + attack,
            decay / TIME_CONSTANTS,
          );
        }
        param.setTargetAtTime(0, start + hold, release / TIME_CONSTANTS);
      };
      const jump = (name: string, value: number) => {
        const param = synth.parameters.get(name);
        if (!param) return;
        param.cancelScheduledValues(now);
        param.setValueAtTime(value, start);
      };

      // The pitch changes in the silence between notes, not through one.
      jump('frequency', state.carrierHz);
      shape(note.gain, 1);
      shape(noteDry.gain, 1);
      const index = synth.parameters.get('index');
      if (index && state.indexFollows) shape(index, state.index);
      else jump('index', state.index);
      jump('ratio', state.ratio);
      jump('mode', 0);
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(state.volume, now, FADE_SECONDS);

      // For the figures' playhead: when, on the page's clock, it starts.
      this.store.set({
        noteStartedAt: performance.now() / 1000 + NOTE_LEAD_SECONDS,
        noteLength: noteSeconds(envelope),
      });
      this.suspendSoon((noteSeconds(envelope) + 1) * 1000);
    } catch (error) {
      console.error('fmlab: audio failed to start', error);
      this.loading = null;
    }
  }

  /**
   * The spectrum of what is playing now, for the live view; null when
   * nothing has been played or the context is asleep.
   */
  measure(): Measurement | null {
    const graph = this.graph;
    if (!graph || graph.context.state !== 'running') return null;
    graph.analyser.getFloatFrequencyData(graph.bins);
    return {
      db: graph.bins,
      sampleRate: graph.context.sampleRate,
      fftSize: graph.analyser.fftSize,
    };
  }

  /** What may change while a note rings: its volume. The rest waits for the next note. */
  private tuneNote(state: LabState): void {
    if (!this.graph) return;
    const { context, master } = this.graph;
    if (context.state !== 'running') return;
    master.gain.setTargetAtTime(state.volume, context.currentTime, FADE_SECONDS);
  }

  private async load(): Promise<Graph> {
    const context = new AudioContext({ latencyHint: 'interactive' });
    await context.audioWorklet.addModule(processorUrl);

    // Two outputs: the sound, stereo (the reverb's wet in it), and the
    // dry sound alone, mono, for the analyser.
    const synth = new AudioWorkletNode(context, PROCESSOR_NAME, {
      numberOfInputs: 0,
      numberOfOutputs: 2,
      outputChannelCount: [2, 1],
    });
    const note = new GainNode(context, { gain: 1 });
    const noteDry = new GainNode(context, { gain: 1 });
    const master = new GainNode(context, { gain: 0 });
    // A compressor set hard enough to be a limiter: a safety net, not an
    // effect. Even at full volume the signal stays under its threshold,
    // though the node's built-in make-up gain lifts everything by about
    // 2 dB.
    const limiter = new DynamicsCompressorNode(context, {
      threshold: -3,
      knee: 0,
      ratio: 20,
      attack: 0.003,
      release: 0.1,
    });
    synth
      .connect(note, 0)
      .connect(master)
      .connect(limiter)
      .connect(context.destination);
    // Tapped before the volume, so the live view's heights are the sound's
    // own, on the same scale as the predicted stems, at any volume. The
    // limiter after it never acts at the levels the lab makes, so this is
    // the spectrum heard.
    const analyser = new AnalyserNode(context, {
      fftSize: FFT_SIZE,
      smoothingTimeConstant: 0.5,
      minDecibels: -100,
      maxDecibels: 0,
    });
    synth.connect(noteDry, 1).connect(analyser);

    this.poolCurrent = false;
    this.voiceReady = false;
    this.graph = {
      context,
      synth,
      note,
      noteDry,
      master,
      analyser,
      bins: new Float32Array(analyser.frequencyBinCount),
    };
    // The reverb as the settings and the page say, from the start.
    synth.port.postMessage(this.reverbMessage());
    return this.graph;
  }

  /**
   * The plate reverb as the worklet should have it: on only in the sandbox
   * with the Reverb setting on (Jeremy, 2026-10-22), and its Pre-delay,
   * Decay, Mix and Tone as set, which the worklet turns into the plate's
   * coefficients.
   */
  private reverbMessage(): ReverbMessage {
    const now = settings.get();
    return {
      type: 'reverb',
      on: now.reverb === 'on' && this.store.get().chapter === 'sandbox',
      seconds: now.reverbDecay,
      mix: now.reverbMix,
      tone: now.reverbTone,
      preDelay: now.reverbPreDelay / 1000,
    };
  }

  /** How much longer a note's sound lasts for the reverb's tail, in ms: none when it is off. */
  private tailMs(): number {
    const { on, seconds, preDelay } = this.reverbMessage();
    return on ? (preDelay + seconds + 0.1) * 1000 : 0;
  }

  /**
   * Moves the synth's params to the steady patch, over `seconds` (0 to
   * jump). A jump also undoes whatever a note's envelope left behind.
   */
  private sendPatch(state: LabState, seconds: number): void {
    if (!this.graph) return;
    const { context, synth, note, noteDry, master } = this.graph;
    const now = context.currentTime;
    const glide = (name: string, value: number) => {
      const param = synth.parameters.get(name);
      if (!param) return;
      // A linear ramp, not setTargetAtTime: it arrives, and the kernel
      // waits for a ratio to stop moving before it re-locks the phase.
      param.cancelScheduledValues(now);
      if (seconds > 0) {
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(value, now + seconds);
      } else {
        param.setValueAtTime(value, now);
      }
    };
    glide('frequency', state.carrierHz);
    glide('ratio', state.ratio);
    glide('index', state.index);
    glide('modFrequency', state.modHz);
    glide('deviation', state.deviationHz);
    // Never glided: it only changes between chapters, in the silence.
    synth.parameters.get('mode')?.setValueAtTime(state.mode === 'fm' ? 1 : 0, now);
    if (seconds > 0) {
      master.gain.setTargetAtTime(state.volume, now, FADE_SECONDS);
    } else {
      for (const gain of [note.gain, noteDry.gain]) {
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(1, now);
      }
    }
  }
}
