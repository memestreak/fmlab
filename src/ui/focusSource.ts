// How focus last arrived, pointer or keyboard, marked on <html> as
// data-focus (Jeremy, 2026-10-21). A browser shows :focus-visible on a
// control a pointer focused as soon as any key is pressed (a note key, an
// arrow), so a clicked slider lit up when the keyboard was played. The
// sandbox's focus rings are drawn only while focus came from the
// keyboard: a pointer-focused control stays unringed whatever keys are
// pressed (arrows moving between tabs or radio keys too), until Tab takes
// focus elsewhere.

/** Marks <html> with where focus came from, each time it moves. */
export function trackFocusSource(): void {
  let last: 'pointer' | 'keyboard' = 'keyboard';
  const root = document.documentElement;
  document.addEventListener('pointerdown', () => (last = 'pointer'), true);
  document.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Tab') last = 'keyboard';
    },
    true,
  );
  document.addEventListener('focusin', () => (root.dataset.focus = last), true);
}
