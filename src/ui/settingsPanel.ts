import type { LabStore } from '../model/lab';
import { saveSettings, type Settings, settings } from '../model/settings';
import type { ThemeChoice } from '../model/theme';
import { tapeLabel } from './dymo';
import { inSandbox } from './motion';

// The sandbox's Settings (Jeremy, 2026-10-21, "a function panel, named
// SETTINGS"): a push key in the masthead opens a modal console, a VFD
// screen listing every setting, one line each, the selected one's
// choices as lamp keys under it. Changes apply as they are made and are
// saved (model/settings.ts); the theme is the masthead switch's own
// choice, kept in step through the lab's store.

/** One line of the panel: its group, its name, its choices and how to read and set it. */
interface Line {
  group: string;
  name: string;
  choices: readonly { value: string; label: string }[];
  get: () => string;
  set: (value: string) => void;
}

const choice = (value: string, label: string) => ({ value, label });

/** The lines, in order; each one a setting. */
function lines(store: LabStore): Line[] {
  const setting = <K extends keyof Settings>(
    group: string,
    name: string,
    key: K,
    labels: Record<Settings[K], string>,
  ): Line => ({
    group,
    name,
    choices: (Object.keys(labels) as Settings[K][]).map(value => choice(value, labels[value])),
    get: () => settings.get()[key],
    set: value => settings.set({ [key]: value } as Partial<Settings>),
  });
  return [
    setting('Screens', 'Screen glitch', 'screenGlitch', { on: 'On', off: 'Off' }),
    setting('Screens', 'Motion', 'motion', { system: 'System', still: 'Still' }),
    setting('Help', 'Tips on hover', 'tips', { on: 'On', off: 'Off' }),
    setting('Help', 'Z X hint', 'zxHint', { hover: 'Hover', always: 'Always', off: 'Off' }),
    setting('Keyboard', 'Note names', 'noteNames', { c: 'C only', all: 'All', off: 'Off' }),
    setting('Keyboard', 'Computer keys', 'computerKeys', { off: 'Off', on: 'On' }),
    setting('Controls', 'Wheel', 'wheel', { page: 'Page', reverse: 'Reverse' }),
    {
      group: 'Look',
      name: 'Theme',
      choices: [choice('auto', 'Auto'), choice('light', 'Light'), choice('dark', 'Dark')],
      get: () => store.get().theme,
      set: value => store.set({ theme: value as ThemeChoice }),
    },
  ];
}

/** The index `steps` along from `at` among `count`, round the ends. */
const round = (at: number, steps: number, count: number) => (((at + steps) % count) + count) % count;

/** Sets the html element's data attributes the settings' CSS keys off. */
export function applySettings(now: Settings): void {
  const root = document.documentElement.dataset;
  root.motion = now.motion;
  root.tips = now.tips;
  root.zx = now.zxHint;
  root.noteNames = now.noteNames;
  root.computerKeys = now.computerKeys;
}

/**
 * Tips off: the sandbox's native titles are put away (kept in
 * `data-tip-off`) while the setting is Off and the sandbox showing, and
 * given back otherwise, whenever any is set.
 */
function governTips(): void {
  const off = () => settings.get().tips === 'off' && inSandbox();
  const sync = () => {
    if (off()) {
      for (const element of document.querySelectorAll('[title]')) {
        element.setAttribute('data-tip-off', element.getAttribute('title') ?? '');
        element.removeAttribute('title');
      }
    } else {
      for (const element of document.querySelectorAll('[data-tip-off]')) {
        element.setAttribute('title', element.getAttribute('data-tip-off') ?? '');
        element.removeAttribute('data-tip-off');
      }
    }
  };
  new MutationObserver(records => {
    if (records.some(record => record.attributeName === 'data-view' || (off() && record.attributeName === 'title'))) sync();
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['title', 'data-view'] });
  settings.subscribe((state, previous) => {
    if (state.tips !== previous.tips) sync();
  });
  sync();
}

/** Builds the Settings key, beside the glossary link, and its panel. */
export function mountSettings(store: LabStore): void {
  const glossary = document.querySelector('.guide-link');
  if (!glossary) return;
  applySettings(settings.get());
  settings.subscribe(now => {
    applySettings(now);
    saveSettings(now);
  });
  governTips();

  const all = lines(store);
  let selected = 0;

  // The key: one lamp key in its own bezel, as Key sync, lit while open.
  const bezel = document.createElement('span');
  bezel.className = 'lamp-keys inst-settings';
  const key = document.createElement('button');
  key.type = 'button';
  key.className = 'lamp-key';
  key.textContent = 'Settings';
  key.setAttribute('aria-haspopup', 'dialog');
  key.setAttribute('aria-controls', 'settings-panel');
  key.setAttribute('aria-expanded', 'false');
  key.setAttribute('aria-pressed', 'false');
  bezel.append(key);
  glossary.before(bezel);

  // The panel: a modal console.
  const dialog = document.createElement('dialog');
  dialog.id = 'settings-panel';
  dialog.className = 'settings-panel';
  dialog.setAttribute('aria-label', 'Settings');
  const head = document.createElement('div');
  head.className = 'settings-head';
  const title = document.createElement('span');
  title.className = 'settings-title';
  title.textContent = 'Settings';
  title.setAttribute('aria-hidden', 'true');
  const closeBezel = document.createElement('span');
  closeBezel.className = 'lamp-keys';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lamp-key settings-close';
  close.textContent = 'Close';
  closeBezel.append(close);
  head.append(title, closeBezel);

  // The screen: a listbox of the lines.
  const screen = document.createElement('div');
  screen.className = 'screen-bezel settings-screen';
  const glass = document.createElement('div');
  glass.className = 'settings-glass';
  glass.tabIndex = 0;
  glass.setAttribute('role', 'listbox');
  glass.setAttribute('aria-label', 'Settings');
  const rows = all.map((line, i) => {
    const row = document.createElement('div');
    row.className = 'settings-line';
    row.id = `settings-line-${i}`;
    row.setAttribute('role', 'option');
    const group = document.createElement('span');
    group.className = 'settings-group';
    group.textContent = line.group;
    const name = document.createElement('span');
    name.className = 'settings-name';
    name.textContent = line.name;
    const value = document.createElement('span');
    value.className = 'settings-value';
    row.append(group, name, value);
    // A click selects the line; on its value, it also turns it to its next choice.
    row.addEventListener('click', event => {
      select(i);
      if (event.target instanceof Element && event.target.closest('.settings-value')) cycle(1);
      glass.focus({ preventScroll: true });
    });
    return { row, value };
  });
  glass.append(...rows.map(r => r.row));
  screen.append(glass);

  // Under the screen: ‹ › through the lines, the selected one's name, its choices.
  const steps = document.createElement('span');
  steps.className = 'chooser settings-steps';
  const step = (label: string, glyph: string, by: number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chooser-key';
    button.textContent = glyph;
    button.setAttribute('aria-label', label);
    button.addEventListener('pointerdown', event => {
      if (event.button === 0) select(round(selected, by, all.length));
    });
    button.addEventListener('click', event => {
      if (event.detail === 0) select(round(selected, by, all.length));
    });
    return button;
  };
  steps.append(step('Previous setting', '‹', -1), step('Next setting', '›', 1));
  const legend = document.createElement('span');
  legend.className = 'settings-legend';
  legend.setAttribute('aria-hidden', 'true');
  const options = document.createElement('span');
  options.className = 'lamp-keys settings-choices';
  options.setAttribute('role', 'radiogroup');
  const controls = document.createElement('div');
  controls.className = 'settings-controls';
  controls.append(steps, legend, options);

  dialog.append(head, screen, controls);
  document.body.append(dialog);
  tapeLabel(title);

  const labelOf = (line: Line) => line.choices.find(c => c.value === line.get())?.label ?? '';
  /** Moves the line's value `by` choices on (Enter, Space, a click), round or held at the ends. */
  const cycle = (by: number, wrap = true) => {
    const line = all[selected];
    const at = line.choices.findIndex(c => c.value === line.get());
    const to = wrap ? round(at, by, line.choices.length) : Math.min(line.choices.length - 1, Math.max(0, at + by));
    if (to !== at) line.set(line.choices[to].value);
  };
  const buildChoices = () => {
    const line = all[selected];
    options.setAttribute('aria-label', line.name);
    const keys = line.choices.map((c, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lamp-key';
      button.setAttribute('role', 'radio');
      button.textContent = c.label;
      const pick = () => line.set(c.value);
      button.addEventListener('pointerdown', event => {
        if (event.button === 0) pick();
      });
      button.addEventListener('click', pick);
      button.addEventListener('keydown', event => {
        const by = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
        if (by === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        const to = round(i, by, line.choices.length);
        line.set(line.choices[to].value);
        (options.children[to] as HTMLElement | undefined)?.focus();
      });
      return button;
    });
    options.replaceChildren(...keys);
  };
  const show = () => {
    rows.forEach(({ row, value }, i) => {
      const line = all[i];
      value.textContent = labelOf(line);
      row.setAttribute('aria-selected', String(i === selected));
      row.setAttribute('aria-label', `${line.name}: ${labelOf(line)}`);
    });
    glass.setAttribute('aria-activedescendant', rows[selected].row.id);
    legend.textContent = all[selected].name;
    const line = all[selected];
    [...options.children].forEach((button, i) => {
      const on = line.choices[i].value === line.get();
      button.setAttribute('aria-checked', String(on));
      (button as HTMLElement).tabIndex = on ? 0 : -1;
    });
  };
  const select = (i: number) => {
    if (i !== selected) {
      selected = i;
      buildChoices();
    }
    show();
    rows[selected].row.scrollIntoView({ block: 'nearest' });
  };

  glass.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const handled: Record<string, () => void> = {
      ArrowUp: () => select(round(selected, -1, all.length)),
      ArrowDown: () => select(round(selected, 1, all.length)),
      ArrowLeft: () => cycle(-1, false),
      ArrowRight: () => cycle(1, false),
      Home: () => select(0),
      End: () => select(all.length - 1),
      Enter: () => cycle(1),
      ' ': () => cycle(1),
    };
    const act = handled[event.key];
    if (!act) return;
    event.preventDefault();
    // The panel's, not the page's: the space bar does not play here.
    event.stopPropagation();
    act();
  });

  const isOpen = () => dialog.open;
  const open = () => {
    if (isOpen()) return;
    select(0);
    dialog.showModal();
    key.setAttribute('aria-pressed', 'true');
    key.setAttribute('aria-expanded', 'true');
    glass.focus({ preventScroll: true });
  };
  const shut = () => {
    if (isOpen()) dialog.close();
  };
  dialog.addEventListener('close', () => {
    key.setAttribute('aria-pressed', 'false');
    key.setAttribute('aria-expanded', 'false');
    key.focus({ preventScroll: true });
  });
  key.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    // Not the press's own focusing, which would take focus from the screen.
    event.preventDefault();
    (isOpen() ? shut : open)();
  });
  key.addEventListener('click', event => {
    if (event.detail === 0) (isOpen() ? shut : open)();
  });
  close.addEventListener('click', shut);
  // A click on the dimmed page round the case closes it.
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) shut();
  });
  // Leaving the sandbox shuts it.
  new MutationObserver(() => {
    if (!inSandbox()) shut();
  }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });

  settings.subscribe(() => {
    if (isOpen()) show();
  });
  store.subscribe((state, previous) => {
    if (state.theme !== previous.theme && isOpen()) show();
  });
  buildChoices();
  show();
}
