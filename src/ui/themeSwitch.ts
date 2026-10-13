import type { LabStore } from '../model/lab';
import { applyTheme, nextTheme, saveTheme, type ThemeChoice } from '../model/theme';

const LABELS: Record<ThemeChoice, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

/**
 * One button that cycles Auto, Light, Dark. The choice lives in the store;
 * a change is applied to <html> and saved for the boot script in
 * index.html to find on the next visit.
 */
export function mountThemeSwitch(button: HTMLButtonElement, store: LabStore): void {
  const show = (theme: ThemeChoice) => {
    button.textContent = `Theme: ${LABELS[theme]}`;
  };

  button.addEventListener('click', () => {
    store.set({ theme: nextTheme(store.get().theme) });
  });
  store.subscribe((state, previous) => {
    if (state.theme === previous.theme) return;
    applyTheme(state.theme);
    saveTheme(state.theme);
    show(state.theme);
  });
  show(store.get().theme);
}
