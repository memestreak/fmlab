import type { LabState } from '../model/lab';
import type { ViewId } from './outline';

/** A slider on the page, by the id of its input in index.html. */
export type ControlId =
  | 'volume'
  | 'carrier'
  | 'ratio'
  | 'index'
  | 'modHz'
  | 'deviation'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release'
  | 'feedback';

/** A figure on the page, by the id of its canvas in index.html. */
export type FigureId =
  | 'algorithm'
  | 'compare'
  | 'waveform'
  | 'envelope'
  | 'spectrum'
  | 'spectrogram'
  | 'bessel';

/**
 * The part of the state a chapter sets when it opens. All of it, every
 * time, so a chapter always starts the same way whatever was left behind
 * by the one before. Volume, sound on or off, and the theme are the
 * reader's and are left alone. Chapters write theirs as BASE_PATCH with
 * their own differences.
 */
export type ChapterPatch = Pick<
  LabState,
  | 'mode'
  | 'carrierHz'
  | 'ratio'
  | 'index'
  | 'modHz'
  | 'deviationHz'
  | 'showModulator'
  | 'showBandwidth'
  | 'realUnits'
  | 'showHarmonics'
  | 'noteMode'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release'
  | 'hold'
  | 'indexFollows'
  | 'algorithm'
  | 'operators'
  | 'feedback'
  | 'voiceModel'
  | 'dxOperators'
  | 'dxFeedback'
  | 'dxLfo'
  | 'compare'
>;

/** An expandable panel: the formulas, for whoever wants them. */
export interface MathsPanel {
  title: string;
  /** Paragraphs of HTML. A formula is `<p class="formula">`. */
  body: string[];
}

/** A button that sets several things at once, to try a sound. */
export interface Preset {
  /** What the button says. */
  label: string;
  /** What the button is for, said to a screen reader after the label. */
  hint: string;
  /** What it sets; anything left out stays as it is. */
  patch: Partial<ChapterPatch>;
  /** A short line shown beside a preset menu while it is chosen. */
  note?: string;
}

/**
 * One step of a chapter that is built up a piece at a time: a section of
 * its text, and a button in the lab and at the head of the section that
 * sets the sound the section is about. Chapter 8 has them.
 */
export interface Step {
  /** What the lab's button says: short. */
  label: string;
  /** The section's heading. */
  title: string;
  /** What it sets. */
  patch: Partial<ChapterPatch>;
  /** The section's paragraphs of HTML. */
  body: string[];
}

/**
 * A chapter is data: its text, what it lets the reader change, and where
 * it starts. The text is HTML written here, in the repository, so it is
 * trusted and put on the page as it is.
 */
export interface Chapter {
  /** Its address (#/index), and its id in the store. */
  id: ViewId;
  /** Its title, from outline.ts. */
  title: string;
  /** The lesson, in plain language: paragraphs of HTML. */
  body: string[];
  maths: MathsPanel[];
  /** The sliders shown, in the page's order. */
  controls: ControlId[];
  /**
   * A slider's label where the chapter calls it something else than the
   * page does: in `sine`, before there is a carrier, Carrier is Frequency.
   */
  labels?: Partial<Record<ControlId, string>>;
  /**
   * Buttons above the sliders that set a whole sound; often none. In a
   * chapter with steps, they belong to the last step and show only there.
   */
  presets: Preset[];
  /**
   * The sections the chapter is built up in, after `body`, each with its
   * own sound. The first is where the chapter opens: its patch is in
   * `patch` too. Most chapters have none.
   */
  steps?: Step[];
  /**
   * Whether to draw its two operators as chapter 8 draws a wiring, small,
   * beside the start of the text: the modulator on the carrier. So the
   * diagrams are familiar by the time chapter 8 needs them.
   */
  showsPair?: boolean;
  /**
   * Whether its presets are one dropdown (the sandbox's 32 DX7 factory
   * voices) rather than a button each.
   */
  presetMenu?: boolean;
  /** Whether to show the piano keyboard, to play the patch at pitches. */
  hasPiano?: boolean;
  /**
   * Whether the chapter is an instrument page (the sandbox) rather than a
   * section: no text column, its controls and figures laid out in
   * `#instrument` (ui/instrument.ts), and `lede`, one line under its
   * title, in place of a lesson.
   */
  instrument?: boolean;
  /** An instrument page's one line, beside its title. Plain text. */
  lede?: string;
  /**
   * Whether the chapter keeps its sound (carrier, ratio, index) in the
   * URL, so that a link brings the same sound back.
   */
  sharesSound?: boolean;
  patch: ChapterPatch;
  /**
   * The figures shown, each with what follows "Fig. n" under it. They
   * appear in the page's order (waveform, envelope, spectrum,
   * spectrogram, Bessel plot) and are numbered from 1 as shown.
   */
  figures: Partial<Record<FigureId, string>>;
}
