import { BASE_PATCH } from './basePatch';
import { GLOSSARY } from './outline';
import type { Chapter } from './types';

export { GLOSSARY };

/**
 * The glossary, written as a chapter for the same reason as the landing
 * view: so everything that follows the store's chapter needs no special
 * case for it. It shows no lab, and plays nothing.
 */
export const glossary: Chapter = {
  id: GLOSSARY,
  title: 'Glossary',
  body: [],
  maths: [],
  controls: ['volume'],
  presets: [],
  patch: BASE_PATCH,
  figures: {},
};
