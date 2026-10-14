import { DEFAULTS } from '../model/lab';
import type { ChapterPatch } from './types';

/**
 * The patch every chapter starts from and then overrides: the sandbox's
 * two operators, steady, in carrier units, with nothing extra drawn. A
 * chapter's patch is this spread with its own differences, so it still
 * sets every field every time it opens.
 */
export const BASE_PATCH: ChapterPatch = {
  mode: 'pm',
  carrierHz: 220,
  ratio: 1,
  index: 2,
  modHz: 5,
  deviationHz: 20,
  showModulator: true,
  showBandwidth: false,
  realUnits: false,
  showHarmonics: false,
  noteMode: false,
  attack: 0.08,
  decay: 0.15,
  sustain: 0.7,
  release: 0.2,
  hold: 0.6,
  indexFollows: true,
  algorithm: DEFAULTS.algorithm,
  operators: DEFAULTS.operators,
  feedback: 0,
  compare: false,
};
