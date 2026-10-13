import type { LabState, LabStore } from '../model/lab';
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

/** The nodes, once there is a context. */
interface Graph {
  context: AudioContext;
  synth: AudioWorkletNode;
  master: GainNode;
}

/**
 * Plays the model: it follows `playing` and the patch in the store and
 * owns everything Web Audio.
 *
 *   worklet (the synth) -> master gain -> limiter -> speakers
 *
 * Nothing is created until `playing` first turns true, which has to happen
 * inside a click or key press: browsers refuse to start audio otherwise.
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
      if (state.playing !== previous.playing) {
        if (state.playing) void this.start();
        else this.stop();
      } else if (state.playing) {
        if (state.chapter !== previous.chapter) this.changeScene();
        else if (!this.changingScene) this.sendPatch(state, GLIDE_SECONDS);
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

  private async start(): Promise<void> {
    window.clearTimeout(this.suspendTimer);
    try {
      // First, while this is still the user's gesture: the iOS unlock, the
      // context (inside load) and the silent element's play().
      if (!this.loading) this.silence = unlockIosAudio();
      this.loading ??= this.load();
      void this.silence?.play().catch(() => {});
      const graph = await this.loading;
      await graph.context.resume();
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
    const graph = this.graph;
    if (!graph) return;
    const { context, master } = graph;
    master.gain.setTargetAtTime(0, context.currentTime, FADE_SECONDS);
    // A suspended context costs nothing; a silent running one still
    // computes every sample.
    this.suspendTimer = window.setTimeout(() => {
      if (!this.store.get().playing) void context.suspend();
    }, SUSPEND_AFTER_MS);
  }

  private async load(): Promise<Graph> {
    const context = new AudioContext({ latencyHint: 'interactive' });
    await context.audioWorklet.addModule(processorUrl);

    const synth = new AudioWorkletNode(context, PROCESSOR_NAME, {
      numberOfInputs: 0,
      outputChannelCount: [1],
    });
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
    synth.connect(master).connect(limiter).connect(context.destination);

    this.graph = { context, synth, master };
    return this.graph;
  }

  /** Moves the synth's params to the patch, over `seconds` (0 to jump). */
  private sendPatch(state: LabState, seconds: number): void {
    if (!this.graph) return;
    const { context, synth, master } = this.graph;
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
    }
  }
}
