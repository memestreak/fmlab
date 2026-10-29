import type { LabStore } from '../model/lab';
import { settings } from '../model/settings';
import { applyTheme, nextTheme, type ThemeChoice } from '../model/theme';

const LABELS: Record<ThemeChoice, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

/** An 18 px line icon in the pen's colour, hidden from screen readers. */
const icon = (paths: string) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ` +
  `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ` +
  `stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/**
 * Each choice's icon, as frets draws them: a circle half filled for Auto
 * (half light, half dark, as the system has it), a sun, a moon.
 */
const ICONS: Record<ThemeChoice, string> = {
  auto: icon(
    '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>',
  ),
  light: icon(
    '<circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41' +
      'M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  ),
  dark: icon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
};

/**
 * What the button shows for a choice: its icon, the name a screen reader
 * gives it ("Theme: Auto"), and the tip that says what a click does.
 */
export function themeButton(choice: ThemeChoice): {
  icon: string;
  label: string;
  title: string;
} {
  const name = LABELS[choice];
  return {
    icon: ICONS[choice],
    label: `Theme: ${name}`,
    title: `Theme: ${name}. Click for ${LABELS[nextTheme(choice)]}.`,
  };
}

/**
 * One small icon button that cycles Auto, Light, Dark. It sets the theme
 * setting (saved in General's Appearance, which the boot script in
 * index.html reads on the next visit); the store follows it, and a
 * change is applied to <html>.
 */
export function mountThemeSwitch(button: HTMLButtonElement, store: LabStore): void {
  const show = (theme: ThemeChoice) => {
    const { icon: svg, label, title } = themeButton(theme);
    button.innerHTML = svg;
    button.setAttribute('aria-label', label);
    button.title = title;
  };

  button.addEventListener('click', () => {
    settings.set({ theme: nextTheme(settings.get().theme) });
  });
  // The setting is the one saved value (the dialog shows it too); the
  // store keeps a copy for the drawings that redraw on a theme change.
  settings.subscribe((now, before) => {
    if (now.theme !== before.theme) store.set({ theme: now.theme });
  });
  store.subscribe((state, previous) => {
    if (state.theme === previous.theme) return;
    applyTheme(state.theme, document.body.dataset.view === 'instrument');
    show(state.theme);
  });
  show(store.get().theme);
}
