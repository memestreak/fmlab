import { BASE_PATCH } from './basePatch';
import type { Chapter } from './types';

/**
 * The number the glossary goes by in the store. Like the landing view it
 * is not a chapter of the guide: it is at "#glossary", not a number, and
 * is drawn from src/chapters/terms.ts rather than from text of its own.
 */
export const GLOSSARY = -1;

/**
 * The glossary, written as a chapter for the same reason as the landing
 * view: so everything that follows the store's chapter needs no special
 * case for it. It shows no lab, and plays nothing.
 */
export const glossary: Chapter = {
  number: GLOSSARY,
  title: 'Glossary',
  navLabel: 'Glossary',
  body: [],
  maths: [],
  controls: ['volume'],
  presets: [],
  hasMotion: false,
  patch: BASE_PATCH,
  figures: {},
};
