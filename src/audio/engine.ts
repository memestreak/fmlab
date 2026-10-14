import { noteSeconds, TIME_CONSTANTS } from '../dsp/envelope';
import { envelopeOf, type LabState, type LabStore } from '../model/lab';
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

/** The nodes, once there is a context. */
interface Graph {
  context: AudioContext;
  synth: AudioWorkletNode;
  /** The envelope's loudness, for a chapter that plays notes; else 1. */
  note: GainNode;
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
 *   worklet (the synth) -> note gain -> master gain -> limiter -> speakers
 *                                  \-> analyser (the live spectrum)
 *
 * There are two ways of playing. Most chapters hold one steady sound while
 * `playing` is true. A chapter in `noteMode` plays one note each time
 * `notes` changes, its loudness (the note gain) and its index shaped by
 * the envelope.
 *
 * Nothing is created until the first sound is asked for, which has to
 * happen inside a click or key press: browsers refuse to start audio
 * otherwise.
 */
export class AudioEngine {
  private graph: Graph | null = null;
  private loading: Promise<Graph> | null = null;
  /** Looping silence that keeps iOS from muting us; see iosUnlock.ts. */
  private silence: HTMLAudioElement | null = null;
  private suspendTimer: number | undefined;
  private sceneTimer: number | undefined;
  /** True while faded out between two chapters' patches. */
  private changingScene = false;

  constructor(private readonly store: LabStore) {
    store.subscribe((state, previous) => {
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
        if (state.chapter !== previous.chapter) this.changeScene();
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
    if (!this.loading) this.silence = unlockIosAudio();
    this.loading ??= this.load();
    void this.silence?.play().catch(() => {});
    const graph = await this.loading;
    await graph.context.resume();
    return graph;
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
    window.clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      if (!this.store.get().playing) void graph.context.suspend();
    }, ms);
  }

  /**
   * Plays one note of the current patch: its loudness and, if the patch
   * says so, its index following the envelope. The curves scheduled here
   * are the ones dsp/envelope.ts describes, which the figures draw.
   */
  private async playNote(): Promise<void> {
    try {
      const { context, synth, note, master } = await this.wake();
      const state = this.store.get();
      if (!state.noteMode) return;

      const envelope = envelopeOf(state);
      const { attack, decay, sustain, release, hold } = envelope;
      const now = context.currentTime;
      const start = now + NOTE_LEAD_SECONDS;

      /** Schedules the envelope on a param, scaled to reach `peak`. */
      const shape = (param: AudioParam, peak: number) => {
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

      shape(note.gain, 1);
      const index = synth.parameters.get('index');
      if (index && state.indexFollows) shape(index, state.index);
      else jump('index', state.index);
      // The pitch changes in the silence between notes, not through one.
      jump('frequency', state.carrierHz);
      jump('ratio', state.ratio);
      jump('mode', 0);
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(state.volume, now, FADE_SECONDS);

      // For the figures' playhead: when, on the page's clock, it starts.
      this.store.set({
        noteStartedAt: performance.now() / 1000 + NOTE_LEAD_SECONDS,
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

    const synth = new AudioWorkletNode(context, PROCESSOR_NAME, {
      numberOfInputs: 0,
      outputChannelCount: [1],
    });
    const note = new GainNode(context, { gain: 1 });
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
      .connect(note)
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
    note.connect(analyser);

    this.graph = {
      context,
      synth,
      note,
      master,
      analyser,
      bins: new Float32Array(analyser.frequencyBinCount),
    };
    return this.graph;
  }

  /**
   * Moves the synth's params to the steady patch, over `seconds` (0 to
   * jump). A jump also undoes whatever a note's envelope left behind.
   */
  private sendPatch(state: LabState, seconds: number): void {
    if (!this.graph) return;
    const { context, synth, note, master } = this.graph;
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
      note.gain.cancelScheduledValues(now);
      note.gain.setValueAtTime(1, now);
    }
  }
}
