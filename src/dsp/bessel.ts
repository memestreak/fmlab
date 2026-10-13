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
