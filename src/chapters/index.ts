import { bessel } from './bessel';
import { envelope } from './envelope';
import { fmVsPm } from './fmVsPm';
import { landing, LANDING } from './landing';
import { modulationIndex } from './modulationIndex';
import { operators } from './operators';
import { ratio } from './ratio';
import { sandbox } from './sandbox';
import { singleSine } from './singleSine';
import type { Chapter } from './types';
import { vibrato } from './vibrato';

export type {
  Chapter,
  ChapterPatch,
  ControlId,
  FigureId,
  MathsPanel,
  Preset,
} from './types';

/**
 * The chapters that exist, in order. Their numbers are the design spec's.
 * Version 1's seven are all here; previous and next would step over any
 * gap.
 */
export const CHAPTERS: readonly Chapter[] = [
  singleSine,
  vibrato,
  modulationIndex,
  bessel,
  ratio,
  envelope,
  sandbox,
  operators,
  fmVsPm,
];

/** The guide's first chapter. (The site itself opens on the landing view.) */
export const FIRST_CHAPTER = CHAPTERS[0].number;

export { landing, LANDING };

/** A chapter of the guide by its number, or the landing view by its own. */
export function chapterByNumber(number: number): Chapter | undefined {
  if (number === LANDING) return landing;
  return CHAPTERS.find(chapter => chapter.number === number);
}

/** The written chapters either side of one, if any. */
export function neighbours(number: number): {
  previous?: Chapter;
  next?: Chapter;
} {
  const at = CHAPTERS.findIndex(chapter => chapter.number === number);
  if (at === -1) return {};
  return { previous: CHAPTERS[at - 1], next: CHAPTERS[at + 1] };
}
