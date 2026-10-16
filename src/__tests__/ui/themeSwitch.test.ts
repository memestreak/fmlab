import { themeButton } from '../../ui/themeSwitch';

describe('the theme switch', () => {
  it('is named for the theme in force, and says what a click does', () => {
    expect(themeButton('auto')).toMatchObject({
      label: 'Theme: Auto',
      title: 'Theme: Auto. Click for Light.',
    });
    expect(themeButton('light').title).toBe('Theme: Light. Click for Dark.');
    expect(themeButton('dark').title).toBe('Theme: Dark. Click for Auto.');
  });

  it('shows a different icon for each, hidden from screen readers', () => {
    const icons = (['auto', 'light', 'dark'] as const).map(c => themeButton(c).icon);
    expect(new Set(icons).size).toBe(3);
    for (const svg of icons) {
      expect(svg).toMatch(/^<svg [^>]*aria-hidden="true"/);
      expect(svg).toContain('stroke="currentColor"');
    }
  });
});
