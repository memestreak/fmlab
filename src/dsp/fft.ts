/**
 * The magnitudes of a real signal's discrete Fourier transform, by the
 * radix-2 fast Fourier transform: |X[k]| for k from 0 to n/2, where
 * X[k] = sum over j of x[j] e^(-2 pi i j k / n). `samples.length` must be
 * a power of two.
 */
export function fftMagnitudes(samples: ArrayLike<number>): Float64Array {
  const n = samples.length;
  if (n < 2 || (n & (n - 1)) !== 0) {
    throw new RangeError(`fftMagnitudes: length must be a power of two, got ${n}`);
  }
  const re = Float64Array.from(samples);
  const im = new Float64Array(n);

  // Reorder by bit-reversed index, so the butterflies can work in place.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
    }
  }

  // Combine transforms of length 2, 4, 8, ... up to n.
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = Math.cos(step * k);
        const wi = Math.sin(step * k);
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }

  const magnitudes = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) magnitudes[k] = Math.hypot(re[k], im[k]);
  return magnitudes;
}
