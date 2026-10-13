/** Auto follows the system; Light and Dark override it. */
export type ThemeChoice = 'auto' | 'light' | 'dark';

/** The order the theme switch cycles through. */
export const THEME_CHOICES: readonly ThemeChoice[] = ['auto', 'light', 'dark'];

/**
 * Where the choice is saved, as the bare word. The boot script in
 * index.html reads the same key before the first paint; keep the two in
 * step.
 */
export const THEME_STORAGE_KEY = 'fmlab.theme';

/** Anything but a known choice, including nothing saved, is Auto. */
export function parseTheme(raw: unknown): ThemeChoice {
  return raw === 'light' || raw === 'dark' ? raw : 'auto';
}

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  const at = THEME_CHOICES.indexOf(choice);
  return THEME_CHOICES[(at + 1) % THEME_CHOICES.length];
}

/** The saved choice. Auto when storage is empty or blocked. */
export function loadTheme(): ThemeChoice {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

export function saveTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage is blocked (private mode): the choice lasts for this visit.
  }
}

/** Sets `data-theme` on <html>, which tokens.css keys its dark values off. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = choice;
  }
}
