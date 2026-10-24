import { type ChoiceSetting, SETTING_CHOICES, saveSettings, type Settings, settings } from '../model/settings';
import { midiInputs } from './midi';
import { glitchScreens } from './screenGlitch';
import { inSandbox } from './motion';

// The sandbox's Settings (Jeremy, 2026-10-21, "a function panel, named
// SETTINGS"): a push key in the masthead opens a modal console, its
// settings on two tabs, General and MIDI (Jeremy, 2026-10-23), a VFD
// screen listing the tab's, one line each, each edited in place (Jeremy,
// 2026-10-23): ‹ value › on its line, its value opening a drop-down of
// its choices. Changes apply as they are made and are saved
// (model/settings.ts). No theme: the sandbox is dark only (Jeremy,
// 2026-10-22).

/**
 * One line of the panel: its group, its name, its choices (worked out
 * when shown: the MIDI inputs come and go) and how to read and set it.
 */
interface Line {
  group: string;
  name: string;
  choices: () => readonly { value: string; label: string }[];
  get: () => string;
  set: (value: string) => void;
}

const choice = (value: string, label: string) => ({ value, label });

/** The panel's tabs: MIDI's lines on their own, everything else General. */
type Page = 'general' | 'midi';
const PAGES: { page: Page; name: string }[] = [
  { page: 'general', name: 'General' },
  { page: 'midi', name: 'MIDI' },
];
const pageOf = (line: Line): Page => (line.group === 'MIDI' ? 'midi' : 'general');

/** The lines, in order; each one a setting. */
function lines(): Line[] {
  const setting = <K extends ChoiceSetting>(
    group: string,
    name: string,
    key: K,
    labels: Record<Settings[K], string>,
  ): Line => ({
    group,
    name,
    choices: () => (Object.keys(labels) as `${Settings[K]}`[]).map(value => choice(value, labels[value as Settings[K]])),
    get: () => String(settings.get()[key]),
    // A choice of numbers (Bend range) is set as its number.
    set: value =>
      settings.set({ [key]: (SETTING_CHOICES[key] as readonly unknown[]).find(c => String(c) === value) } as Partial<Settings>),
  });
  // MIDI's (Jeremy, 2026-10-23): the input, by name, from those connected,
  // and the one chosen even while it is not; the channel, all or 1 to 16.
  const input: Line = {
    group: 'MIDI',
    name: 'Input',
    choices: () => {
      const names = [...new Set(midiInputs.get().names)];
      const chosen = settings.get().midiInput;
      const gone = chosen !== '' && !names.includes(chosen) ? [choice(chosen, `${chosen} (not connected)`)] : [];
      return [choice('', 'All inputs'), ...names.map(name => choice(name, name)), ...gone];
    },
    get: () => settings.get().midiInput,
    set: value => settings.set({ midiInput: value }),
  };
  const channel: Line = {
    group: 'MIDI',
    name: 'Channel',
    choices: () => Array.from({ length: 17 }, (_, n) => choice(String(n), n === 0 ? 'All' : String(n))),
    get: () => String(settings.get().midiChannel),
    set: value => settings.set({ midiChannel: Number(value) }),
  };
  return [
    setting('Screens', 'Screen glitch', 'screenGlitch', { on: 'On', off: 'Off' }),
    setting('Screens', 'Motion', 'motion', { system: 'System', still: 'Still' }),
    setting('Help', 'Tips on hover', 'tips', { on: 'On', off: 'Off' }),
    setting('Help', 'Z X hint', 'zxHint', { hover: 'Hover', always: 'Always', off: 'Off' }),
    setting('Keyboard', 'Note names', 'noteNames', { c: 'C only', all: 'All', off: 'Off' }),
    setting('Keyboard', 'Computer keys', 'computerKeys', { off: 'Off', on: 'On' }),
    setting('Keyboard', 'Key velocity', 'keyVelocity', { 64: '64', 100: '100', 127: '127' }),
    setting('Controls', 'Wheel', 'wheel', { page: 'Page', reverse: 'Reverse' }),
    input,
    channel,
    setting('MIDI', 'Bend range', 'bendRange', {
      1: '±1 st',
      2: '±2 st',
      3: '±3 st',
      5: '±5 st',
      7: '±7 st',
      12: '±12 st',
    }),
    setting('MIDI', 'Velocity curve', 'velocityCurve', { light: 'Light', normal: 'Normal', heavy: 'Heavy' }),
  ];
}

/** The index `steps` along from `at` among `count`, round the ends. */
const round = (at: number, steps: number, count: number) => (((at + steps) % count) + count) % count;

const button = (className: string, text: string) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = text;
  return element;
};

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
export function mountSettings(): void {
  const glossary = document.querySelector('.guide-link');
  if (!glossary) return;
  applySettings(settings.get());
  settings.subscribe(now => {
    applySettings(now);
    saveSettings(now);
  });
  governTips();

  const all = lines();
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
  title.className = 'settings-title silk-plate';
  title.textContent = 'Settings';
  title.setAttribute('aria-hidden', 'true');
  const closeBezel = document.createElement('span');
  closeBezel.className = 'lamp-keys';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lamp-key settings-close';
  close.textContent = 'Close';
  closeBezel.append(close);
  const tabs = document.createElement('div');
  tabs.className = 'pill-tabs settings-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Settings');
  const tabKeys = PAGES.map(({ page, name }, i) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = `settings-tab-${page}`;
    tab.className = 'pill-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `settings-page-${page}`);
    tab.textContent = name;
    // Chosen on the press, as the Voice tabs are; the click after finds it open.
    tab.addEventListener('pointerdown', event => {
      if (event.button === 0) choosePage(page);
    });
    tab.addEventListener('click', () => choosePage(page));
    tab.addEventListener('keydown', event => {
      const to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: PAGES.length - 1 }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      const next = (to + PAGES.length) % PAGES.length;
      choosePage(PAGES[next].page);
      tabKeys[next].focus();
    });
    return tab;
  });
  tabs.append(...tabKeys);
  head.append(title, tabs, closeBezel);

  // The screen: the open tab's lines, each one control: its group and
  // name, then ‹ value ›. Up and Down move between them, Left and Right
  // (or ‹ ›) step the value, held at the ends, and its value, Enter or
  // Space open the drop-down of its choices.
  const screen = document.createElement('div');
  screen.className = 'screen-bezel settings-screen';
  const glass = document.createElement('div');
  glass.className = 'settings-glass';
  const rows = all.map((line, i) => {
    const row = document.createElement('div');
    row.className = 'settings-line';
    row.id = `settings-line-${i}`;
    row.tabIndex = -1;
    row.setAttribute('role', 'spinbutton');
    row.setAttribute('aria-label', `${line.group} ${line.name}`);
    row.setAttribute('aria-haspopup', 'listbox');
    row.setAttribute('aria-expanded', 'false');
    row.setAttribute('aria-description', 'Left and Right change it; Enter opens its list');
    const group = document.createElement('span');
    group.className = 'settings-group';
    group.textContent = line.group;
    group.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'settings-name';
    name.textContent = line.name;
    name.setAttribute('aria-hidden', 'true');
    const edit = document.createElement('span');
    edit.className = 'settings-edit';
    edit.setAttribute('aria-hidden', 'true');
    const back = button('settings-arrow', '‹');
    const on = button('settings-arrow', '›');
    const value = document.createElement('span');
    value.className = 'settings-value';
    for (const [arrow, by] of [
      [back, -1],
      [on, 1],
    ] as const) {
      arrow.tabIndex = -1;
      // Worked on the press, as the chooser keys are; the line keeps focus.
      arrow.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.preventDefault();
        select(i);
        rows[i].row.focus({ preventScroll: true });
        step(by);
      });
    }
    edit.append(back, value, on);
    row.append(group, name, edit);
    row.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('.settings-arrow')) return;
      select(i);
      row.focus({ preventScroll: true });
      if (event.target instanceof Element && event.target.closest('.settings-value')) toggleMenu();
    });
    return { row, value, back, on };
  });
  // One page of lines a tab, both in the glass's one cell, the closed one
  // unseen: the glass keeps the longer one's size whichever is open.
  const pages = new Map(
    PAGES.map(({ page, name }) => {
      const element = document.createElement('div');
      element.className = 'settings-page';
      element.id = `settings-page-${page}`;
      element.dataset.page = page;
      element.setAttribute('role', 'tabpanel');
      element.setAttribute('aria-labelledby', `settings-tab-${page}`);
      element.setAttribute('aria-label', name);
      element.append(...rows.filter((_, i) => pageOf(all[i]) === page).map(r => r.row));
      return [page, element];
    }),
  );
  glass.append(...pages.values());
  screen.append(glass);

  dialog.append(head, screen);
  document.body.append(dialog);

  let page: Page = 'general';
  /** The lines of the open tab, by index. */
  const shown = () => all.flatMap((line, i) => (pageOf(line) === page ? [i] : []));
  /** The line `by` along from the selected one in the open tab, round its ends. */
  const along = (by: number) => {
    const lines = shown();
    return lines[round(lines.indexOf(selected), by, lines.length)];
  };
  const showPage = () => {
    tabKeys.forEach((tab, i) => {
      const on = PAGES[i].page === page;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    for (const [name, element] of pages) {
      const on = name === page;
      element.classList.toggle('is-closed', !on);
      element.inert = !on;
    }
  };
  /** Opens a tab, its first line selected; the glass glitches over the change. */
  function choosePage(to: Page): void {
    if (to === page) return;
    page = to;
    closeMenu(false);
    showPage();
    select(shown()[0]);
    glitchScreens([glass]);
  }

  const at = (line: Line) => line.choices().findIndex(c => c.value === line.get());
  const labelOf = (line: Line) => line.choices()[at(line)]?.label ?? '';
  /** Moves the selected line's value `by` choices on, held at the ends. */
  const step = (by: number) => {
    const line = all[selected];
    const choices = line.choices();
    const from = at(line);
    const to = Math.min(choices.length - 1, Math.max(0, from + by));
    if (to !== from) line.set(choices[to].value);
  };

  const show = () => {
    rows.forEach(({ row, value, back, on }, i) => {
      const line = all[i];
      const label = labelOf(line);
      const index = at(line);
      const count = line.choices().length;
      value.textContent = label;
      // The whole of a long one (an input's name), cut short on the line.
      value.title = label;
      row.classList.toggle('is-selected', i === selected);
      row.tabIndex = i === selected ? 0 : -1;
      row.setAttribute('aria-valuetext', label);
      row.setAttribute('aria-valuenow', String(Math.max(0, index)));
      row.setAttribute('aria-valuemin', '0');
      row.setAttribute('aria-valuemax', String(count - 1));
      back.classList.toggle('is-end', index <= 0);
      on.classList.toggle('is-end', index >= count - 1);
    });
  };
  const select = (i: number) => {
    if (i !== selected) closeMenu(false);
    selected = i;
    show();
    rows[selected].row.scrollIntoView({ block: 'nearest' });
  };
  const focusLine = () => rows[selected].row.focus({ preventScroll: true });

  glass.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const handled: Record<string, () => void> = {
      ArrowUp: () => select(along(-1)),
      ArrowDown: () => select(along(1)),
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      Home: () => select(shown()[0]),
      End: () => select(shown().at(-1) ?? selected),
      Enter: () => openMenu(),
      ' ': () => openMenu(),
    };
    const act = handled[event.key];
    if (!act) return;
    event.preventDefault();
    // The panel's, not the page's: the space bar does not play here.
    event.stopPropagation();
    act();
    if (!menuOpen()) focusLine();
  });

  // The drop-down (Jeremy, 2026-10-23: "way too many MIDI devices" to
  // step through; then every line's): a list on VFD glass under the line,
  // over the screen, scrolling inside itself, never past the case or the
  // window. Up, Down, Home, End, Page Up and Down move; Enter, Space or a
  // click choose and close it; Esc, Tab or a press elsewhere close it as
  // it was. Focus goes back to the line; the note keys still play.
  const menu = document.createElement('div');
  menu.className = 'settings-menu';
  menu.id = 'settings-menu';
  menu.tabIndex = -1;
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  dialog.append(menu);
  for (const { row } of rows) row.setAttribute('aria-controls', menu.id);
  let menuAt = 0;
  const menuChoices = () => all[selected].choices();
  const menuOpen = () => !menu.hidden;
  const markMenu = () => {
    const chosen = all[selected].get();
    [...menu.children].forEach((option, i) => {
      option.setAttribute('aria-selected', String(menuChoices()[i]?.value === chosen));
      option.classList.toggle('is-active', i === menuAt);
    });
    const active = menu.children[menuAt] as HTMLElement | undefined;
    if (active) {
      menu.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    }
  };
  const fillMenu = () => {
    const line = all[selected];
    menu.setAttribute('aria-label', line.name);
    menu.replaceChildren(
      ...line.choices().map((c, i) => {
        const option = document.createElement('div');
        option.className = 'settings-menu-option';
        option.id = `settings-menu-${i}`;
        option.setAttribute('role', 'option');
        option.textContent = c.label;
        // The whole name, cut short on the glass.
        option.title = c.label;
        option.setAttribute('aria-label', c.label);
        option.addEventListener('click', () => chooseFromMenu(i));
        return option;
      }),
    );
    menuAt = Math.max(0, Math.min(menuAt, menu.children.length - 1));
  };
  /** Under the selected line, as wide, as tall as its list or the room left in the case and the window. */
  const placeMenu = () => {
    const box = dialog.getBoundingClientRect();
    const row = rows[selected].row.getBoundingClientRect();
    const floor = Math.min(box.bottom, window.innerHeight) - 12;
    // Placed from inside the case's border.
    menu.style.left = `${row.left - box.left - dialog.clientLeft}px`;
    menu.style.top = `${row.bottom - box.top - dialog.clientTop}px`;
    menu.style.width = `${row.width}px`;
    menu.style.maxHeight = `${Math.max(48, floor - row.bottom)}px`;
  };
  function openMenu(): void {
    if (menuOpen()) return;
    fillMenu();
    menuAt = Math.max(0, at(all[selected]));
    menu.hidden = false;
    rows[selected].row.setAttribute('aria-expanded', 'true');
    placeMenu();
    markMenu();
    menu.focus({ preventScroll: true });
  }
  function closeMenu(refocus = true): void {
    if (!menuOpen()) return;
    menu.hidden = true;
    for (const { row } of rows) row.setAttribute('aria-expanded', 'false');
    if (refocus && dialog.open) focusLine();
  }
  function toggleMenu(): void {
    if (menuOpen()) closeMenu();
    else openMenu();
  }
  function chooseFromMenu(i: number): void {
    const c = menuChoices()[i];
    if (c) all[selected].set(c.value);
    closeMenu();
  }
  menu.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const count = menu.children.length;
    const moves: Record<string, number> = {
      ArrowUp: menuAt - 1,
      ArrowDown: menuAt + 1,
      Home: 0,
      End: count - 1,
      PageUp: menuAt - 8,
      PageDown: menuAt + 8,
    };
    if (event.key in moves) {
      menuAt = Math.max(0, Math.min(count - 1, moves[event.key]));
      markMenu();
    } else if (event.key === 'Enter' || event.key === ' ') {
      chooseFromMenu(menuAt);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      // The list only, not the case round it.
      closeMenu();
    } else {
      // The note keys still play.
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
  // A press anywhere else closes it as it was; the line's value toggles it itself.
  document.addEventListener(
    'pointerdown',
    event => {
      if (!menuOpen() || !(event.target instanceof Node)) return;
      if (menu.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest('.settings-line.is-selected .settings-value')) return;
      closeMenu(false);
    },
    { capture: true },
  );
  window.addEventListener('resize', () => {
    if (menuOpen()) placeMenu();
  });

  const isOpen = () => dialog.open;
  const open = () => {
    if (isOpen()) return;
    // Always on General: the open tab is not kept.
    page = 'general';
    showPage();
    select(0);
    dialog.showModal();
    key.setAttribute('aria-pressed', 'true');
    key.setAttribute('aria-expanded', 'true');
    focusLine();
  };
  const shut = () => {
    if (isOpen()) dialog.close();
  };
  dialog.addEventListener('close', () => {
    closeMenu(false);
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

  // The Input line's choices come and go with the inputs.
  const refresh = () => {
    if (!isOpen()) return;
    // The inputs came or went, or the choice changed: the open list follows.
    if (menuOpen()) {
      fillMenu();
      markMenu();
    }
    show();
  };
  settings.subscribe(refresh);
  midiInputs.subscribe(refresh);
  showPage();
  show();
}
