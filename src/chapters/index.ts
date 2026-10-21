import { bessel } from './bessel';
import { dx7Voice } from './dx7Voice';
import { envelope } from './envelope';
import { fmVsPm } from './fmVsPm';
import { glossary, GLOSSARY } from './glossary';
import { landing, LANDING } from './landing';
import { modulationIndex } from './modulationIndex';
import { operators } from './operators';
import { ratio } from './ratio';
import { sandbox } from './sandbox';
import { singleSine } from './singleSine';
import { SECTION_IDS, type SectionId, type ViewId } from './outline';
import type { Chapter } from './types';
import { vibrato } from './vibrato';

export type {
  Chapter,
  ChapterPatch,
  ControlId,
  FigureId,
  MathsPanel,
  Preset,
  PresetBank,
} from './types';

const ALL: readonly Chapter[] = [
  singleSine,
  vibrato,
  modulationIndex,
  bessel,
  ratio,
  envelope,
  operators,
  fmVsPm,
  dx7Voice,
  sandbox,
];

/**
 * The guide's sections, in the order outline.ts gives them; previous and
 * next follow it.
 */
export const CHAPTERS: readonly Chapter[] = SECTION_IDS.map(
  id => ALL.find(chapter => chapter.id === id)!,
);

/** The guide's first section. (The site itself opens on the landing view.) */
export const FIRST_CHAPTER = CHAPTERS[0].id as SectionId;

export { glossary, GLOSSARY, landing, LANDING };

/**
 * A section of the guide by its id, or the landing view or the glossary
 * by theirs.
 */
export function chapterById(id: string): Chapter | undefined {
  if (id === LANDING) return landing;
  if (id === GLOSSARY) return glossary;
  return CHAPTERS.find(chapter => chapter.id === id);
}

/** Whether an id names something the page can show. */
export function isViewId(id: string): id is ViewId {
  return chapterById(id) !== undefined;
}

/** The sections either side of one, if any. */
export function neighbours(id: string): {
  previous?: Chapter;
  next?: Chapter;
} {
  const at = CHAPTERS.findIndex(chapter => chapter.id === id);
  if (at === -1) return {};
  return { previous: CHAPTERS[at - 1], next: CHAPTERS[at + 1] };
}

/**
 * Where Previous and Next go from a view, in the bottom links and round
 * the masthead's crumb alike: the landing view comes before the first
 * section (its Next is the first section, the first section's Previous
 * is it), and the sections run on to the sandbox. The glossary, outside
 * the sequence, has neither.
 */
export function sequenceNeighbours(id: string): { previous?: Chapter; next?: Chapter } {
  if (id === LANDING) return { next: CHAPTERS[0] };
  if (id === CHAPTERS[0].id) return { previous: landing, next: neighbours(id).next };
  return neighbours(id);
}
