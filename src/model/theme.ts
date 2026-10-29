/**
 * Auto follows the system; Light and Dark override it. The choice is a
 * setting, saved in General's Appearance (model/settings.ts), which the
 * boot script in index.html reads before the first paint.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';

/** The order the theme switch cycles through. */
export const THEME_CHOICES: readonly ThemeChoice[] = ['auto', 'light', 'dark'];

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  const at = THEME_CHOICES.indexOf(choice);
  return THEME_CHOICES[(at + 1) % THEME_CHOICES.length];
}

/**
 * Sets `data-theme` on <html>, which tokens.css keys its dark values off.
 * The sandbox is dark only (Jeremy, 2026-10-22): there the choice is set
 * aside, and put back on the way out.
 */
export function applyTheme(choice: ThemeChoice, sandbox = false): void {
  const root = document.documentElement;
  if (sandbox) {
    root.dataset.theme = 'dark';
  } else if (choice === 'auto') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = choice;
  }
}
