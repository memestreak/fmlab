import { type ChoiceSetting, SETTING_CHOICES, saveSettings, type Settings, settings } from '../model/settings';
import { tapeLabel } from './dymo';
import { midiInputs } from './midi';
import { glitchScreens } from './screenGlitch';
import { createVfdReadout } from './vfdReadout';
import { inSandbox } from './motion';

// The sandbox's Settings (Jeremy, 2026-10-21, "a function panel, named
// SETTINGS"): a push key in the masthead opens a modal console, its
// settings on two tabs, General and MIDI (Jeremy, 2026-10-23), a VFD
// screen listing the tab's, one line each, the selected one's
// choices as lamp keys under it (or, for MIDI's lines, ‹ ›, round a VFD
// readout for Channel). Changes apply as they are made and are
// saved (model/settings.ts). No theme: the sandbox is dark only
// (Jeremy, 2026-10-22).

/**
 * One line of the panel: its group, its name, its choices (worked out
 * when shown: the MIDI inputs come and go) and how to read and set it.
 * With `stepper`, too many choices for lamp keys (or too long: an
 * interface's ports): under the glass, ‹ › instead, the choice read on
 * the glass; with `readout` too, round a two-place VFD readout of it
 * (MIDI Channel).
 */
interface Line {
  group: string;
  name: string;
  choices: () => readonly { value: string; label: string }[];
  get: () => string;
  set: (value: string) => void;
  stepper?: boolean;
  readout?: (value: string) => string;
  /** A list too long to step through (the MIDI inputs): its value, Enter or Space opens it as a drop-down. */
  menu?: boolean;
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
    stepper = false,
  ): Line => ({
    group,
    name,
    stepper,
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
    stepper: true,
    menu: true,
  };
  const channel: Line = {
    group: 'MIDI',
    name: 'Channel',
    choices: () => Array.from({ length: 17 }, (_, n) => choice(String(n), n === 0 ? 'All' : String(n))),
    get: () => String(settings.get().midiChannel),
    set: value => settings.set({ midiChannel: Number(value) }),
    stepper: true,
    readout: value => (value === '0' ? 'AL' : value),
  };
  return [
    setting('Screens', 'Screen glitch', 'screenGlitch', { on: 'On', off: 'Off' }),
    setting('Screens', 'Motion', 'motion', { system: 'System', still: 'Still' }),
    setting('Help', 'Tips on hover', 'tips', { on: 'On', off: 'Off' }),
    setting('Help', 'Z X hint', 'zxHint', { hover: 'Hover', always: 'Always', off: 'Off' }),
    setting('Keyboard', 'Note names', 'noteNames', { c: 'C only', all: 'All', off: 'Off' }),
    setting('Keyboard', 'Computer keys', 'computerKeys', { off: 'Off', on: 'On' }),
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
    }, true),
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
      glass.focus({ preventScroll: true });
      if (event.target instanceof Element && event.target.closest('.settings-value')) {
        if (all[i].menu) toggleMenu();
        else cycle(1);
      }
    });
    return { row, value };
  });
  // One page of lines a tab, both in the glass's one cell, the closed one
  // unseen: the glass keeps the longer one's size whichever is open.
  const pages = new Map(
    PAGES.map(({ page, name }) => {
      const element = document.createElement('div');
      element.className = 'settings-page';
      element.id = `settings-page-${page}`;
      element.dataset.page = page;
      element.setAttribute('role', 'group');
      element.setAttribute('aria-label', name);
      element.append(...rows.filter((_, i) => pageOf(all[i]) === page).map(r => r.row));
      return [page, element];
    }),
  );
  glass.append(...pages.values());
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
      if (event.button === 0) select(along(by));
    });
    button.addEventListener('click', event => {
      if (event.detail === 0) select(along(by));
    });
    return button;
  };
  steps.append(step('Previous setting', '‹', -1), step('Next setting', '›', 1));
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

  const labelOf = (line: Line) => line.choices().find(c => c.value === line.get())?.label ?? '';
  /** Moves the line's value `by` choices on (Enter, Space, a click), round or held at the ends. */
  const cycle = (by: number, wrap = true) => {
    const line = all[selected];
    const choices = line.choices();
    const at = choices.findIndex(c => c.value === line.get());
    const to = wrap ? round(at, by, choices.length) : Math.min(choices.length - 1, Math.max(0, at + by));
    if (to !== at) line.set(choices[to].value);
  };
  /** A stepper line: its VFD under the glass, if it has one, kept with its value. */
  let readout: { update: () => void } | null = null;
  const buildChoices = () => {
    const line = all[selected];
    options.setAttribute('aria-label', line.name);
    readout = null;
    if (line.stepper) {
      // ‹ ›, round its readout if it has one, the octave chooser's: a step
      // on the press, held at the ends, as Left and Right on the line.
      const format = line.readout;
      const vfd = format
        ? createVfdReadout({ get: () => Number(line.get()), format: value => format(String(value)), places: 2 })
        : null;
      readout = vfd ?? { update: () => {} };
      const key = (label: string, glyph: string, by: number) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'chooser-key';
        button.textContent = glyph;
        button.setAttribute('aria-label', `${label} ${line.name.toLowerCase()}`);
        button.addEventListener('pointerdown', event => {
          if (event.button === 0) cycle(by, false);
        });
        button.addEventListener('click', event => {
          if (event.detail === 0) cycle(by, false);
        });
        return button;
      };
      options.className = `chooser settings-choices${vfd ? ' settings-readout' : ' settings-stepper'}`;
      options.setAttribute('role', 'group');
      options.replaceChildren(key('Previous', '‹', -1), ...(vfd ? [vfd.element] : []), key('Next', '›', 1));
      return;
    }
    options.className = 'lamp-keys settings-choices';
    options.setAttribute('role', 'radiogroup');
    const choices = line.choices();
    const keys = choices.map((c, i) => {
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
        const to = round(i, by, choices.length);
        line.set(choices[to].value);
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
      // The whole of a long one (an input's name), cut short on the glass.
      value.title = labelOf(line);
      row.setAttribute('aria-selected', String(i === selected));
      row.setAttribute('aria-label', `${line.name}: ${labelOf(line)}`);
    });
    glass.setAttribute('aria-activedescendant', rows[selected].row.id);
    legend.textContent = all[selected].name;
    const line = all[selected];
    if (readout) {
      readout.update();
      return;
    }
    const choices = line.choices();
    [...options.children].forEach((button, i) => {
      const on = choices[i]?.value === line.get();
      button.setAttribute('aria-checked', String(on));
      (button as HTMLElement).tabIndex = on ? 0 : -1;
    });
  };
  // The drop-down (Jeremy, 2026-10-23: "way too many MIDI devices" to
  // step through): a list on VFD glass under the line, over the screen,
  // scrolling inside itself, never past the case or the window. Up, Down,
  // Home, End move; Enter, Space or a click choose and close it; Esc, Tab
  // or a click elsewhere close it as it was. Focus goes back to the line.
  const menu = document.createElement('div');
  menu.className = 'settings-menu';
  menu.id = 'settings-menu';
  menu.tabIndex = -1;
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  dialog.append(menu);
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
    menuAt = Math.max(0, menuChoices().findIndex(c => c.value === all[selected].get()));
    menu.hidden = false;
    placeMenu();
    markMenu();
    menu.focus({ preventScroll: true });
  }
  function closeMenu(refocus = true): void {
    if (!menuOpen()) return;
    menu.hidden = true;
    if (refocus && dialog.open) glass.focus({ preventScroll: true });
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
    const moves: Record<string, number> = { ArrowUp: menuAt - 1, ArrowDown: menuAt + 1, Home: 0, End: count - 1, PageUp: menuAt - 8, PageDown: menuAt + 8 };
    if (event.key in moves) {
      menuAt = Math.max(0, Math.min(count - 1, moves[event.key]));
      markMenu();
    } else if (event.key === 'Enter' || event.key === ' ') {
      chooseFromMenu(menuAt);
    } else if (event.key === 'Escape') {
      // The list only, not the case round it.
      closeMenu();
    } else if (event.key === 'Tab') {
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
      if (event.target instanceof Element && event.target.closest('.settings-line[aria-selected="true"] .settings-value')) return;
      closeMenu(false);
    },
    { capture: true },
  );
  window.addEventListener('resize', () => {
    if (menuOpen()) placeMenu();
  });

  const select = (i: number) => {
    if (i !== selected) closeMenu(false);
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
      ArrowUp: () => select(along(-1)),
      ArrowDown: () => select(along(1)),
      ArrowLeft: () => cycle(-1, false),
      ArrowRight: () => cycle(1, false),
      Home: () => select(shown()[0]),
      End: () => select(shown().at(-1) ?? selected),
      Enter: () => (all[selected].menu ? openMenu() : cycle(1)),
      ' ': () => (all[selected].menu ? openMenu() : cycle(1)),
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
    // Always on General: the open tab is not kept.
    page = 'general';
    showPage();
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

  // The Input line's choices come and go with the inputs, read on the
  // glass; a line of lamp keys is made again when its count changes.
  const refresh = () => {
    if (!isOpen()) return;
    // The inputs came or went, or the choice changed: the open list follows.
    if (menuOpen()) {
      fillMenu();
      markMenu();
    }
    const line = all[selected];
    if (!line.stepper && options.children.length !== line.choices().length) buildChoices();
    show();
  };
  settings.subscribe(refresh);
  midiInputs.subscribe(refresh);
  showPage();
  buildChoices();
  show();
}
