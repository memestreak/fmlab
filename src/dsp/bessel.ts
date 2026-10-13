/** A term this small next to the running sum no longer changes it. */
const EPSILON = 1e-17;

/**
 * Bessel function of the first kind, J_n(x), for an integer order n.
 *
 * Summed from its power series,
 *
 *   J_n(x) = sum over k >= 0 of (-1)^k / (k! (k+n)!) * (x/2)^(2k+n)
 *
 * with each term made from the one before it. The terms alternate in sign
 * and grow to about e^|x| before they shrink, so the rounding error grows
 * with |x|: around 1e-12 at |x| = 10 and 1e-8 at |x| = 20. That is far more
 * than a modulation index needs; a larger argument wants another method.
 */
export function besselJ(n: number, x: number): number {
  if (!Number.isInteger(n)) {
    throw new RangeError(`besselJ: order must be an integer, got ${n}`);
  }
  // J_-n = (-1)^n J_n
  if (n < 0) {
    return (n % 2 === 0 ? 1 : -1) * besselJ(-n, x);
  }

  const half = x / 2;
  const halfSquared = half * half;

  // The k = 0 term, (x/2)^n / n!
  let term = 1;
  for (let i = 1; i <= n; i++) {
    term *= half / i;
  }

  let sum = term;
  for (let k = 1; term !== 0; k++) {
    term *= -halfSquared / (k * (k + n));
    sum += term;
    // The terms only shrink for good once k passes |x|/2.
    if (k > Math.abs(half) && Math.abs(term) < EPSILON * Math.abs(sum)) {
      break;
    }
  }
  return sum;
}

/** Miller's recurrence starts this far past the point where J_n dies. */
const MILLER_ACCURACY = 160;
/** Rescale the recurrence before it overflows a double. */
const HUGE = 1e250;

/**
 * J_0(x) to J_nMax(x) in one go, for any size of x.
 *
 * The power series above loses its accuracy as |x| grows, and a slow
 * vibrato is a very large index (a 20 Hz deviation at 0.5 Hz is 40). This
 * is Miller's algorithm instead: start well above both nMax and |x| with a
 * made-up tiny value, run the recurrence
 *
 *   J_(k-1)(x) = (2k / x) J_k(x) - J_(k+1)(x)
 *
 * downwards, where it is stable, and then scale everything so that
 * J_0 + 2 (J_2 + J_4 + ...) = 1, which the true values satisfy.
 */
export function besselJSeries(nMax: number, x: number): Float64Array {
  const result = new Float64Array(nMax + 1);
  if (x === 0) {
    result[0] = 1;
    return result;
  }
  const ax = Math.abs(x);
  const top = Math.max(nMax, Math.ceil(ax));
  // An even order to start from, comfortably past the last one that
  // matters.
  const start = 2 * Math.ceil((top + Math.sqrt(MILLER_ACCURACY * top) + 2) / 2);

  let above = 0;
  let current = 1e-30;
  let sum = 0;
  for (let k = start; k > 0; k--) {
    const below = ((2 * k) / ax) * current - above;
    above = current;
    current = below;
    if (Math.abs(current) > HUGE) {
      above /= HUGE;
      current /= HUGE;
      sum /= HUGE;
      for (let n = 0; n <= nMax; n++) result[n] /= HUGE;
    }
    // `current` is now J_(k-1), still unscaled.
    if (k - 1 <= nMax) result[k - 1] = current;
    if ((k - 1) % 2 === 0) sum += k - 1 === 0 ? current : 2 * current;
  }

  for (let n = 0; n <= nMax; n++) {
    result[n] /= sum;
    // J_n(-x) = (-1)^n J_n(x)
    if (x < 0 && n % 2 === 1) result[n] = -result[n];
  }
  return result;
}
