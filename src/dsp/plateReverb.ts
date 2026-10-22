// The sandbox's plate reverb (Jeremy, 2026-10-22): Jon Dattorro's plate,
// "Effect Design, Part 1: Reverberator and Other Filters", J. Audio Eng.
// Soc. 45(9), 1997, figure 1 and tables 1 and 2. Mono in (the voices'
// sum), stereo out from the paper's left and right taps. No DOM and no
// Web Audio: the worklet runs it, and the tests run it in node. Nothing
// is made new after the constructor.

/** The paper's sample rate: every length below is in its samples. */
const PAPER_RATE = 29761;

/** The longest pre-delay, in seconds (the Pre-delay setting's top; Jeremy, 2026-10-22). */
export const MAX_PRE_DELAY_SECONDS = 0.5;
/** The input low-pass's coefficient (table 1's bandwidth). */
const BANDWIDTH = 0.9995;
/** The four input diffusers (figure 1): lengths and coefficients (input diffusion 1, 2). */
const INPUT_DIFFUSERS: readonly [number, number][] = [
  [142, 0.75],
  [107, 0.75],
  [379, 0.625],
  [277, 0.625],
];
/** The tank's first diffusers' coefficient (decay diffusion 1), its sign turned (figure 1's "note sign"). */
const DECAY_DIFFUSION_1 = 0.7;
/** The modulated allpasses' greatest excursion (table 1), and their rate (section 1.3.7: about 1 Hz). */
const EXCURSION = 16;
const MODULATION_HZ = 1;
/**
 * The tank's two halves (figure 1): the modulated allpass (672 and 908
 * plus the excursion), a delay, the damping, the second allpass, and a
 * delay whose end goes to the other half.
 */
const TANK = {
  left: { modulated: 672, delay1: 4453, allpass: 1800, delay2: 3720 },
  right: { modulated: 908, delay1: 4217, allpass: 2656, delay2: 3163 },
} as const;

/** Table 2's taps: which line, how far in (paper samples), and its sign; each at 0.6. */
type Line = 'leftDelay1' | 'leftAllpass' | 'leftDelay2' | 'rightDelay1' | 'rightAllpass' | 'rightDelay2';
const TAP_GAIN = 0.6;
const LEFT_TAPS: readonly [Line, number, number][] = [
  ['rightDelay1', 266, 1],
  ['rightDelay1', 2974, 1],
  ['rightAllpass', 1913, -1],
  ['rightDelay2', 1996, 1],
  ['leftDelay1', 1990, -1],
  ['leftAllpass', 187, -1],
  ['leftDelay2', 1066, -1],
];
const RIGHT_TAPS: readonly [Line, number, number][] = [
  ['leftDelay1', 353, 1],
  ['leftDelay1', 3627, 1],
  ['leftAllpass', 1228, -1],
  ['leftDelay2', 2673, 1],
  ['rightDelay1', 2111, -1],
  ['rightAllpass', 335, -1],
  ['rightDelay2', 121, -1],
];

/** How long a change of the settings takes to glide, in seconds. */
export const REVERB_GLIDE_SECONDS = 0.05;
/** The decay coefficient's ceiling, whatever time is asked for. */
export const MAX_DECAY = 0.9995;
/**
 * The measured -60 dB time over the time asked for, uncorrected: the
 * input diffusers lengthen it, the damping shortens it. Fitted at Tone 70
 * so 0.5 to 20 s measure within 15% (plateReverb.test.ts): +13% at 0.5 s,
 * 0% at 1.5 s, -7% at 5 and 20 s. 0.2 s is as short as the diffusion
 * allows: it measures about 0.33 s.
 */
export const DECAY_FIT = 0.94;

/** A delay line: written a sample at a time, read so many samples back. */
class Delay {
  private readonly buffer: Float32Array;
  private readonly mask: number;
  private at = 0;

  constructor(longest: number) {
    let size = 1;
    while (size < longest + 2) size *= 2;
    this.buffer = new Float32Array(size);
    this.mask = size - 1;
  }

  write(x: number): void {
    this.at = (this.at + 1) & this.mask;
    this.buffer[this.at] = x;
  }

  /** The sample written `back` samples ago (0 is the last written). */
  read(back: number): number {
    return this.buffer[(this.at - back) & this.mask];
  }

  /** As `read`, between samples, in a straight line. */
  readFrac(back: number): number {
    const whole = Math.floor(back);
    const a = this.read(whole);
    return a + (this.read(whole + 1) - a) * (back - whole);
  }

  clear(): void {
    this.buffer.fill(0);
  }
}

/**
 * An allpass lattice (figure 1's diffusers): `length` samples long,
 * coefficient `g`. The lattice: v = x - g d, the line takes v, out
 * d + g v, where d is the line's output.
 */
function allpass(line: Delay, length: number, g: number, x: number): number {
  const d = line.read(length - 1);
  const v = x - g * d;
  line.write(v);
  return d + g * v;
}

/**
 * What the main thread tells the worklet about the reverb (engine.ts):
 * whether it is heard (on in the sandbox alone), its -60 dB time in
 * seconds, its mix and its tone, 0 to 100, and its pre-delay in seconds. The worklet turns them into
 * the plate's coefficients.
 */
export interface ReverbMessage {
  type: 'reverb';
  on: boolean;
  seconds: number;
  mix: number;
  tone: number;
  /** In seconds. */
  preDelay: number;
}

/**
 * What the reverb is asked for: its -60 dB time in seconds, its tone 0
 * to 100, its mix 0 to 100, and its pre-delay in seconds.
 */
export interface ReverbSettings {
  seconds: number;
  tone: number;
  mix: number;
  preDelay: number;
}

/** The paper's decay coefficient for a -60 dB time of `seconds`, at `rate`, round a loop of `loop` samples. */
export function decayFor(seconds: number, rate: number, loop: number): number {
  // Round the figure eight the signal is multiplied by the decay four
  // times in `loop` samples: g^(4 n / loop) = 10^-3 at n = seconds x rate.
  const g = 10 ** ((-3 * loop) / (4 * rate * Math.max(0.01, seconds / DECAY_FIT)));
  return Math.min(MAX_DECAY, g);
}

/**
 * The tank's first diffusers' coefficient for a -60 dB time of `seconds`:
 * the paper's 0.7, less for a short time. An allpass of coefficient g on a
 * line of `length` samples rings on by itself, g a pass, for
 * 3 length / (rate x -log10 g) seconds: 0.43 s at 0.7, longer than a
 * short decay. So it is held to ring no longer than DIFFUSION_SHARE of
 * the time asked, as the paper ties decay diffusion 2 to the decay.
 */
export function diffusionFor(seconds: number, rate: number, length: number): number {
  const ring = DIFFUSION_SHARE * Math.max(0.01, seconds);
  return Math.min(DECAY_DIFFUSION_1, 10 ** ((-3 * length) / (rate * ring)));
}

/** The longest the tank's first diffusers may ring, as a share of the decay time. */
export const DIFFUSION_SHARE = 0.4;

/** The damping for a tone, 0 (darkest) to 100 (brightest, none). */
export function dampingFor(tone: number): number {
  return 0.7 * (1 - Math.min(100, Math.max(0, tone)) / 100);
}

/** The dry and wet gains for a mix, 0 to 100: both full at 50. */
export function mixGains(mix: number): { dry: number; wet: number } {
  const m = Math.min(100, Math.max(0, mix)) / 100;
  return { dry: Math.min(1, 2 * (1 - m)), wet: Math.min(1, 2 * m) };
}

/** A gliding value: towards `target` by `step` a sample. */
interface Glide {
  now: number;
  target: number;
  step: number;
}

export class PlateReverb {
  private readonly rate: number;
  private readonly scale: number;
  private readonly preDelay: Delay;
  /**
   * The pre-delay's taps, in samples back: `tap` the one set; while a turn
   * fades (equal power, REVERB_GLIDE_SECONDS), `fromA` and `fromB`, the
   * sound playing when it was turned, at their weights. The read point is
   * never moved, so the wet's pitch never bends.
   */
  private tap = 0;
  private fromA = 0;
  private fromB = 0;
  private weightA = 1;
  private weightB = 0;
  private fadeLeft = 0;
  private readonly diffusers: { line: Delay; length: number; g: number }[];
  private readonly lines: Record<Line, Delay>;
  private readonly lengths: Record<Line | 'leftModulated' | 'rightModulated', number>;
  private readonly leftModulated: Delay;
  private readonly rightModulated: Delay;
  private readonly excursion: number;
  private readonly leftTaps: { line: Delay; back: number; sign: number }[];
  private readonly rightTaps: { line: Delay; back: number; sign: number }[];
  /** The loop's length, in samples: the figure eight's eight lines. */
  readonly loop: number;
  private bandwidthState = 0;
  private leftDamp = 0;
  private rightDamp = 0;
  private phase = 0;
  private readonly phaseStep: number;
  private readonly decay: Glide = { now: 0.5, target: 0.5, step: 0 };
  private readonly diffusion: Glide = { now: DECAY_DIFFUSION_1, target: DECAY_DIFFUSION_1, step: 0 };
  private readonly damping: Glide = { now: 0, target: 0, step: 0 };
  private readonly dry: Glide = { now: 1, target: 1, step: 0 };
  private readonly wet: Glide = { now: 0, target: 0, step: 0 };
  private readonly glideSamples: number;
  /** Whether it runs: on, or off but still gliding the wet down. */
  private running = false;
  private on = false;
  private seconds = 1.5;
  private preDelaySeconds = 0;

  constructor(sampleRate: number) {
    this.rate = sampleRate;
    this.scale = sampleRate / PAPER_RATE;
    const at = (paper: number) => Math.max(1, Math.round(paper * this.scale));
    // Its longest, once: a turn of Pre-delay never makes anything new.
    this.preDelay = new Delay(Math.ceil(MAX_PRE_DELAY_SECONDS * sampleRate) + 2);
    this.diffusers = INPUT_DIFFUSERS.map(([length, g]) => ({ line: new Delay(at(length)), length: at(length), g }));
    this.excursion = EXCURSION * this.scale;
    this.lengths = {
      leftModulated: at(TANK.left.modulated),
      leftDelay1: at(TANK.left.delay1),
      leftAllpass: at(TANK.left.allpass),
      leftDelay2: at(TANK.left.delay2),
      rightModulated: at(TANK.right.modulated),
      rightDelay1: at(TANK.right.delay1),
      rightAllpass: at(TANK.right.allpass),
      rightDelay2: at(TANK.right.delay2),
    };
    const reach = Math.ceil(this.excursion) + 2;
    this.leftModulated = new Delay(this.lengths.leftModulated + reach);
    this.rightModulated = new Delay(this.lengths.rightModulated + reach);
    this.lines = {
      leftDelay1: new Delay(this.lengths.leftDelay1),
      leftAllpass: new Delay(this.lengths.leftAllpass),
      leftDelay2: new Delay(this.lengths.leftDelay2),
      rightDelay1: new Delay(this.lengths.rightDelay1),
      rightAllpass: new Delay(this.lengths.rightAllpass),
      rightDelay2: new Delay(this.lengths.rightDelay2),
    };
    const taps = (list: readonly [Line, number, number][]) =>
      list.map(([line, back, sign]) => ({ line: this.lines[line], back: Math.min(this.lengths[line] - 1, at(back)), sign }));
    this.leftTaps = taps(LEFT_TAPS);
    this.rightTaps = taps(RIGHT_TAPS);
    const l = this.lengths;
    this.loop =
      l.leftModulated + l.leftDelay1 + l.leftAllpass + l.leftDelay2 + l.rightModulated + l.rightDelay1 + l.rightAllpass + l.rightDelay2;
    this.phaseStep = (2 * Math.PI * MODULATION_HZ) / sampleRate;
    this.glideSamples = Math.max(1, Math.round(REVERB_GLIDE_SECONDS * sampleRate));
    this.set({ seconds: 1.5, tone: 70, mix: 25, preDelay: 0 }, false);
    // At rest: the first set does not glide.
    for (const glide of [this.decay, this.diffusion, this.damping, this.dry, this.wet]) glide.now = glide.target;
    this.fadeLeft = 0;
  }

  /** The -60 dB time now, and the pre-delay: how long the tail rings. */
  get tailSeconds(): number {
    return this.on ? this.seconds + this.preDelaySeconds : 0;
  }

  /** Whether it is running (on, or gliding off). */
  get active(): boolean {
    return this.running;
  }

  /**
   * New settings, glided to over REVERB_GLIDE_SECONDS. Off glides the
   * wet down, then stops and clears; on starts from clear lines and glides
   * the wet up from nothing.
   */
  set({ seconds, tone, mix, preDelay }: ReverbSettings, on = this.on): void {
    if (on && !this.running) {
      this.clear();
      this.wet.now = 0;
      this.running = true;
    }
    this.on = on;
    this.seconds = seconds;
    this.preDelaySeconds = Math.min(MAX_PRE_DELAY_SECONDS, Math.max(0, preDelay));
    this.turnTap(Math.round(this.preDelaySeconds * this.rate));
    const gains = mixGains(mix);
    this.aim(this.decay, decayFor(seconds, this.rate, this.loop));
    this.aim(this.diffusion, diffusionFor(seconds, this.rate, this.lengths.leftModulated));
    this.aim(this.damping, dampingFor(tone));
    this.aim(this.dry, on ? gains.dry : 1);
    this.aim(this.wet, on ? gains.wet : 0);
  }

  /**
   * A new pre-delay: the tap fades over from the sound playing now. Mid
   * fade, that sound is the old taps and the new at their weights now; the
   * two loudest are kept (the third, fading, is let go).
   */
  private turnTap(to: number): void {
    if (to === this.tap && this.fadeLeft === 0) return;
    if (this.fadeLeft === 0) {
      this.fromA = this.fromB = this.tap;
      this.weightA = 1;
      this.weightB = 0;
    } else {
      const angle = (Math.PI / 2) * (1 - this.fadeLeft / this.glideSamples);
      const playing: [number, number][] = [
        [this.fromA, this.weightA * Math.cos(angle)],
        [this.fromB, this.weightB * Math.cos(angle)],
        [this.tap, Math.sin(angle)],
      ];
      playing.sort((a, b) => b[1] - a[1]);
      [[this.fromA, this.weightA], [this.fromB, this.weightB]] = playing;
    }
    this.tap = to;
    this.fadeLeft = this.glideSamples;
  }

  private aim(glide: Glide, target: number): void {
    glide.target = target;
    glide.step = Math.abs(target - glide.now) / this.glideSamples;
  }

  /** Empties every line and filter. */
  clear(): void {
    this.preDelay.clear();
    this.fadeLeft = 0;
    for (const { line } of this.diffusers) line.clear();
    for (const line of Object.values(this.lines)) line.clear();
    this.leftModulated.clear();
    this.rightModulated.clear();
    this.bandwidthState = this.leftDamp = this.rightDamp = 0;
  }

  /**
   * `frames` samples of `input` (the dry sound) out to `left` and `right`:
   * the dry at its gain and the plate's wet at its own. While it is not
   * running, the dry alone. Nothing is made new here.
   */
  process(input: Float32Array, left: Float32Array, right: Float32Array, frames: number): void {
    if (!this.running) {
      for (let i = 0; i < frames; i++) left[i] = right[i] = input[i];
      return;
    }
    const { diffusers, lines, lengths, leftTaps, rightTaps } = this;
    const leftModLength = lengths.leftModulated;
    const rightModLength = lengths.rightModulated;
    for (let i = 0; i < frames; i++) {
      const decay = step(this.decay);
      const diffusion = step(this.diffusion);
      const damping = step(this.damping);
      const dry = step(this.dry);
      const wet = step(this.wet);
      // The input: pre-delay (at 0 straight through; a turn crossfades
      // from the old tap to the new, equal power), the bandwidth's
      // low-pass, four diffusers.
      this.preDelay.write(input[i]);
      let x = this.preDelay.read(this.tap);
      if (this.fadeLeft > 0) {
        this.fadeLeft--;
        const angle = (Math.PI / 2) * (1 - this.fadeLeft / this.glideSamples);
        const from = this.weightA * this.preDelay.read(this.fromA) + this.weightB * this.preDelay.read(this.fromB);
        x = Math.cos(angle) * from + Math.sin(angle) * x;
      }
      this.bandwidthState += BANDWIDTH * (x - this.bandwidthState);
      x = this.bandwidthState;
      for (let d = 0; d < diffusers.length; d++) {
        const diffuser = diffusers[d];
        x = allpass(diffuser.line, diffuser.length, diffuser.g, x);
      }
      // The tank: each half fed by the other's end.
      const leftEnd = lines.leftDelay2.read(lengths.leftDelay2 - 1);
      const rightEnd = lines.rightDelay2.read(lengths.rightDelay2 - 1);
      this.phase += this.phaseStep;
      if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
      // The two modulated allpasses in quadrature, so they never move together.
      const leftSwing = this.excursion * Math.sin(this.phase);
      const rightSwing = this.excursion * Math.cos(this.phase);
      const decayDiffusion2 = Math.min(0.5, Math.max(0.25, decay + 0.15));

      let l = x + decay * rightEnd;
      {
        // Decay diffusion 1, its sign turned, its length swinging.
        const d = this.leftModulated.readFrac(leftModLength - 1 + leftSwing);
        const v = l + diffusion * d;
        this.leftModulated.write(v);
        l = d - diffusion * v;
      }
      const lDelayed = lines.leftDelay1.read(lengths.leftDelay1 - 1);
      lines.leftDelay1.write(l);
      l = lDelayed;
      this.leftDamp += (1 - damping) * (l - this.leftDamp);
      l = this.leftDamp * decay;
      l = allpass(lines.leftAllpass, lengths.leftAllpass, decayDiffusion2, l);
      lines.leftDelay2.write(l);

      let r = x + decay * leftEnd;
      {
        const d = this.rightModulated.readFrac(rightModLength - 1 + rightSwing);
        const v = r + diffusion * d;
        this.rightModulated.write(v);
        r = d - diffusion * v;
      }
      const rDelayed = lines.rightDelay1.read(lengths.rightDelay1 - 1);
      lines.rightDelay1.write(r);
      r = rDelayed;
      this.rightDamp += (1 - damping) * (r - this.rightDamp);
      r = this.rightDamp * decay;
      r = allpass(lines.rightAllpass, lengths.rightAllpass, decayDiffusion2, r);
      lines.rightDelay2.write(r);

      // Table 2's taps, all wet.
      let yl = 0;
      for (let t = 0; t < leftTaps.length; t++) yl += leftTaps[t].sign * leftTaps[t].line.read(leftTaps[t].back);
      let yr = 0;
      for (let t = 0; t < rightTaps.length; t++) yr += rightTaps[t].sign * rightTaps[t].line.read(rightTaps[t].back);
      const drySample = input[i] * dry;
      left[i] = drySample + wet * TAP_GAIN * yl;
      right[i] = drySample + wet * TAP_GAIN * yr;
    }
    // Off, and the wet all the way down: stop, and start clear next time.
    if (!this.on && this.wet.now === 0 && this.dry.now === 1) {
      this.running = false;
      this.clear();
    }
  }
}

/** One sample along a glide. */
function step(glide: Glide): number {
  const gap = glide.target - glide.now;
  if (gap !== 0) glide.now = Math.abs(gap) <= glide.step ? glide.target : glide.now + Math.sign(gap) * glide.step;
  return glide.now;
}
