// The chapter is in the URL's hash, "#2", so a chapter can be linked to and
// survives a reload. With no hash the site opens on the landing view.
// Nothing else is in the URL yet.

/**
 * The chapter a hash names, or `fallback` when it names none that exists:
 * no hash, not a number, or a number with no chapter.
 *
 * @param numbers the chapters that exist
 */
export function chapterFromHash(
  hash: string,
  numbers: readonly number[],
  fallback: number,
): number {
  const match = /^#(\d+)$/.exec(hash);
  if (!match) return fallback;
  const number = Number(match[1]);
  return numbers.includes(number) ? number : fallback;
}

export function hashForChapter(number: number): string {
  return `#${number}`;
}

/**
 * Whether a hash is one the page should take out of the address bar: it
 * is there, but names no chapter, so the page is showing the landing view
 * under an address that claims otherwise.
 */
export function isStrayHash(hash: string, numbers: readonly number[]): boolean {
  if (hash === '' || hash === '#') return false;
  return chapterFromHash(hash, numbers, -1) === -1;
}
