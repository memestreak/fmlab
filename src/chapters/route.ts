// The chapter is in the URL's hash, "#2", so a chapter can be linked to and
// survives a reload. Nothing else is in the URL yet.

/**
 * The chapter a hash names, or `fallback` when it names none that exists:
 * no hash, not a number, or a chapter that is not written yet.
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
