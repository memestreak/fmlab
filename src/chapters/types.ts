import type { LabState } from '../model/lab';

/** A slider on the page, by the id of its input in index.html. */
export type ControlId =
  | 'volume'
  | 'carrier'
  | 'ratio'
  | 'index'
  | 'modHz'
  | 'deviation';

/**
 * The part of the state a chapter sets when it opens. All of it, every
 * time, so a chapter always starts the same way whatever was left behind
 * by the one before. Volume, sound on or off, and the theme are the
 * reader's and are left alone.
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
>;

/** An expandable panel: the formulas, for whoever wants them. */
export interface MathsPanel {
  title: string;
  /** Paragraphs of HTML. A formula is `<p class="formula">`. */
  body: string[];
}

/**
 * A chapter is data: its text, what it lets the reader change, and where
 * it starts. The text is HTML written here, in the repository, so it is
 * trusted and put on the page as it is.
 */
export interface Chapter {
  /** Its number in the design spec. The URL hash, and the order. */
  number: number;
  title: string;
  /** What the contents list in the masthead calls it: short. */
  navLabel: string;
  /** The lesson, in plain language: paragraphs of HTML. */
  body: string[];
  maths: MathsPanel[];
  /** The sliders shown, in the page's order. */
  controls: ControlId[];
  /**
   * Whether to offer "Show motion", for a chapter whose waveform figure
   * has a moving view.
   */
  hasMotion: boolean;
  patch: ChapterPatch;
  /** What follows "Fig. n" under each figure. */
  captions: { waveform: string; spectrum: string };
}
