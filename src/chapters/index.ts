import { sandbox } from './sandbox';
import { singleSine } from './singleSine';
import type { Chapter } from './types';
import { vibrato } from './vibrato';

export type { Chapter, ChapterPatch, ControlId, MathsPanel } from './types';

/**
 * The chapters that exist, in order. Their numbers are the design spec's,
 * so there are gaps where chapters are not written yet; previous and next
 * step over the gaps.
 */
export const CHAPTERS: readonly Chapter[] = [singleSine, vibrato, sandbox];

/** Where the guide opens. */
export const FIRST_CHAPTER = CHAPTERS[0].number;

export function chapterByNumber(number: number): Chapter | undefined {
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
