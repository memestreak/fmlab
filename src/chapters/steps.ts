import { isDx7 } from '../dsp/algorithms';
import type { Step } from './types';

/**
 * Which step a chapter is at, from the algorithm in force: the step that
 * set it, or, for any of the DX7's 32, the step that offers them all.
 * Steps differ by their wiring, so the wiring says which one is showing,
 * and nothing else needs keeping.
 */
export function currentStep(steps: readonly Step[], algorithmNumber: number): number {
  const own = steps.findIndex(step => step.patch.algorithm === algorithmNumber);
  if (own >= 0) return own;
  if (isDx7(algorithmNumber)) {
    const all = steps.findIndex(step => isDx7(step.patch.algorithm ?? 0));
    if (all >= 0) return all;
  }
  return 0;
}

/** Whether `index` is the step that offers every DX7 algorithm. */
export function isLastStep(steps: readonly Step[], index: number): boolean {
  return index === steps.length - 1;
}
