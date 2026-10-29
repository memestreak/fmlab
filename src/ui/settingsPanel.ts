import { type ChoiceSetting, SETTING_CHOICES, type Settings, settings, settingsSaveFailed } from '../model/settings';
import {
  draftDiffers,
  paneHeading,
  resetField,
  shownTree,
  type TreeGroup,
  type TreeSection,
} from '../model/settingsTree';
import { formatLastVelocity, midiInputs, midiLast } from './midi';
import { inSandbox } from './motion';
import { glitchScreens } from './screenGlitch';

// Settings (the settings philosophy; Jeremy, 2026-10-29): one modal
// dialog holding every preference, shaped like REAPER's Preferences. A
// tree on the left, General (Appearance) and Synth (Display, Keyboard,
// MIDI), each group opening and closing under its ▸/▾ head; on the right
// the selected section's fields under its `Group › Section` heading, on
// the console's VFD glass, one line each: its name, then ‹ value ›, its
// value opening a drop-down of its choices (Jeremy, 2026-10-23). Changes
// are staged: OK saves and closes, Apply saves and stays, Cancel (Esc,
// Close) throws them away. A double click on a name, or a long press,
// puts it back to its default, staged too. The synth's Settings key opens
// it at Synth; the chapters' gear at General.

/** One line of the pane: a setting, or a readout (MIDI's Last velocity). */
interface Line {
  section: TreeSection;
  name: string;
  /** The setting it shows; none for a readout. */
  key?: keyof Settings;
  /** Its choices, worked out when shown: the MIDI inputs come and go. */
  choices: () => readonly { value: string; label: string }[];
  get: () => string;
  set: (value: string) => void;
  /** A line only read, not set: its value. Up and Down pass it by. */
  readout?: () => string;
  /** Said to a screen reader after its name. */
  description?: string;
}

const choice = (value: string, label: string) => ({ value, label });

/** How long a touch on a name is held to put it back to its default, in ms. */
export const LONG_PRESS_MS = 550;

/** Each choice setting's name and labels, in the order its line steps. */
const CHOICE_LINES: { [K in ChoiceSetting]?: { name: string; labels: Record<Settings[K], string>; description?: string } } = {
  theme: {
    name: 'Guide theme',
    labels: { auto: 'Auto', light: 'Light', dark: 'Dark' },
    description: 'The guide’s pages; the synth is always dark',
  },
  motion: { name: 'Motion', labels: { system: 'System', still: 'Still' } },
  tips: { name: 'Tips on hover', labels: { on: 'On', off: 'Off' } },
  screenGlitch: { name: 'Screen glitch', labels: { on: 'On', off: 'Off' } },
  zxHint: { name: 'Z X hint', labels: { hover: 'Hover', always: 'Always', off: 'Off' } },
  noteNames: { name: 'Note names', labels: { c: 'C only', all: 'All', off: 'Off' } },
  computerKeys: { name: 'Computer keys', labels: { off: 'Off', on: 'On' } },
  keyVelocity: { name: 'Key velocity', labels: { 64: '64', 100: '100', 127: '127' } },
  wheel: { name: 'Wheel', labels: { page: 'Page', reverse: 'Reverse' } },
  midi: { name: 'MIDI in', labels: { off: 'Off', on: 'On' } },
  bendRange: {
    name: 'Bend range',
    labels: { 1: '±1 st', 2: '±2 st', 3: '±3 st', 5: '±5 st', 7: '±7 st', 12: '±12 st' },
  },
  velocityCurve: {
    name: 'Velocity curve',
    labels: { lightest: 'Lightest', light: 'Light', normal: 'Normal', heavy: 'Heavy', heaviest: 'Heaviest' },
  },
};

/** The index `steps` along from `at` among `count`, round the ends. */
const round = (at: number, steps: number, count: number) => (((at + steps) % count) + count) % count;

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const made = document.createElement(tag);
  made.className = className;
  if (text !== undefined) made.textContent = text;
  return made;
};

const button = (className: string, text: string) => {
  const made = element('button', className, text);
  made.type = 'button';
  return made;
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
 * Tips off: the page's native titles are put away (kept in
 * `data-tip-off`) while the setting is Off, on every page (Jeremy,
 * 2026-10-29: app-wide), and given back when it is On.
 */
function governTips(): void {
  const off = () => settings.get().tips === 'off';
  const sync = () => {
    if (off()) {
      for (const tipped of document.querySelectorAll('[title]')) {
        tipped.setAttribute('data-tip-off', tipped.getAttribute('title') ?? '');
        tipped.removeAttribute('title');
      }
    } else {
      for (const tipped of document.querySelectorAll('[data-tip-off]')) {
        tipped.setAttribute('title', tipped.getAttribute('data-tip-off') ?? '');
        tipped.removeAttribute('data-tip-off');
      }
    }
  };
  new MutationObserver(records => {
    if (off() && records.some(record => record.attributeName === 'title')) sync();
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['title'] });
  settings.subscribe((state, previous) => {
    if (state.tips !== previous.tips) sync();
  });
  sync();
}

/** A gear, for the chapters' masthead: ink, as the theme switch's icons. */
const GEAR =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' +
  '<path d="M10.3 2.5h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.5.5v3.4l-2.5.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9-2.6-.5v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z"/>' +
  '<circle cx="12" cy="12" r="3.2"/></svg>';

/** Builds the synth's Settings key, the chapters' gear and the dialog both open. */
export function mountSettings(): void {
  const learn = document.querySelector('.inst-learn');
  if (!learn) return;
  applySettings(settings.get());
  // Saved by the settings themselves (model/settings.ts).
  settings.subscribe(applySettings);
  governTips();

  const tree = shownTree();
  /** What the dialog shows and edits: the saved settings, then staged changes. */
  let draft: Settings = { ...settings.get() };
  const stage = (patch: Partial<Settings>) => {
    draft = { ...draft, ...patch };
    show();
  };

  // The lines, every section's, in order.
  const sectionLines = (section: TreeSection): Line[] =>
    section.fields.flatMap((key): Line[] => {
      if (key === 'midiInput') {
        // The input, by name, from those connected, and the one chosen even
        // while it is not (Jeremy, 2026-10-23).
        return [
          {
            section,
            key,
            name: 'Input',
            choices: () => {
              const names = [...new Set(midiInputs.get().names)];
              const chosen = draft.midiInput;
              const gone = chosen !== '' && !names.includes(chosen) ? [choice(chosen, `${chosen} (not connected)`)] : [];
              return [choice('', 'All inputs'), ...names.map(name => choice(name, name)), ...gone];
            },
            get: () => draft.midiInput,
            set: value => stage({ midiInput: value }),
          },
        ];
      }
      if (key === 'midiChannel') {
        return [
          {
            section,
            key,
            name: 'Channel',
            choices: () => Array.from({ length: 17 }, (_, n) => choice(String(n), n === 0 ? 'All' : String(n))),
            get: () => String(draft.midiChannel),
            set: value => stage({ midiChannel: Number(value) }),
          },
        ];
      }
      const spec = CHOICE_LINES[key as ChoiceSetting];
      if (!spec) return [];
      const labels = spec.labels as Record<string, string>;
      const line: Line = {
        section,
        key,
        name: spec.name,
        description: spec.description,
        choices: () => Object.keys(labels).map(value => choice(value, labels[value])),
        get: () => String(draft[key]),
        // A choice of numbers (Bend range) is set as its number.
        set: value =>
          stage({
            [key]: (SETTING_CHOICES[key as ChoiceSetting] as readonly unknown[]).find(c => String(c) === value),
          } as Partial<Settings>),
      };
      // MIDI's Last velocity (Jeremy, 2026-10-25), read only, after the curve.
      if (key === 'velocityCurve') {
        return [
          line,
          {
            section,
            name: 'Last velocity',
            choices: () => [],
            get: () => '',
            set: () => {},
            readout: () => formatLastVelocity(midiLast.get()),
          },
        ];
      }
      return [line];
    });
  const all: Line[] = tree.flatMap(group => group.sections.flatMap(sectionLines));

  let selected = 0;
  let group: TreeGroup = tree[0];
  let section: TreeSection = group.sections[0];
  const expanded = new Set<string>();

  // The synth's key: one lamp key in its own bezel, lit while open, right
  // of the Learn key, the last of the title bar's keys (Jeremy, 2026-10-29).
  const bezel = element('span', 'lamp-keys inst-settings');
  const key = button('lamp-key', 'Settings');
  bezel.append(key);
  learn.after(bezel);
  // The chapters' gear, the last of their masthead's actions, after the theme.
  const gear = button('theme-switch settings-gear', '');
  gear.innerHTML = GEAR;
  gear.setAttribute('aria-label', 'Settings');
  gear.title = 'Settings';
  document.querySelector('#theme')?.after(gear);
  for (const opener of [key, gear]) {
    opener.setAttribute('aria-haspopup', 'dialog');
    opener.setAttribute('aria-controls', 'settings-panel');
    opener.setAttribute('aria-expanded', 'false');
  }
  key.setAttribute('aria-pressed', 'false');

  // The dialog: a console of the synth's, the same on every page (its
  // keys' styles are the synth's, so it carries its view).
  const dialog = element('dialog', 'settings-panel settings-dialog');
  dialog.id = 'settings-panel';
  dialog.dataset.view = 'instrument';
  dialog.setAttribute('aria-label', 'Settings');
  const head = element('div', 'settings-head');
  const title = element('span', 'settings-title silk-plate', 'Settings');
  title.setAttribute('aria-hidden', 'true');
  const closeBezel = element('span', 'lamp-keys');
  const close = button('lamp-key settings-close', 'Close');
  close.setAttribute('aria-label', 'Close without saving');
  closeBezel.append(close);
  head.append(title, closeBezel);

  // The tree: each group's head (▸ closed, ▾ open) and its sections under it.
  const treeNav = element('nav', 'settings-tree');
  treeNav.setAttribute('aria-label', 'Settings sections');
  const groupHeads = new Map<string, HTMLButtonElement>();
  const sectionKeys = new Map<TreeSection, HTMLButtonElement>();
  const groupLists = new Map<string, HTMLElement>();
  for (const g of tree) {
    const head = button('settings-tree-group', '');
    head.dataset.group = g.id;
    head.append(element('span', 'settings-tree-mark'), element('span', 'settings-tree-name', g.name));
    head.addEventListener('click', () => {
      if (expanded.has(g.id)) expanded.delete(g.id);
      else expanded.add(g.id);
      showTree();
    });
    const list = element('div', 'settings-tree-sections');
    list.id = `settings-tree-${g.id}`;
    head.setAttribute('aria-controls', list.id);
    for (const s of g.sections) {
      const item = button('settings-tree-section', s.name);
      item.addEventListener('click', () => chooseSection(g, s));
      sectionKeys.set(s, item);
      list.append(item);
    }
    groupHeads.set(g.id, head);
    groupLists.set(g.id, list);
    treeNav.append(head, list);
  }
  // Up and Down between the tree's items shown; Right opens a group, Left
  // closes it (or goes up to it from a section).
  treeNav.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const items = [...treeNav.querySelectorAll<HTMLButtonElement>('button')].filter(item => item.offsetParent !== null);
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const item = items[at];
    const groupId = item.dataset.group ?? tree.find(g => g.sections.some(s => sectionKeys.get(s) === item))?.id;
    const moves: Record<string, () => void> = {
      ArrowUp: () => items[Math.max(0, at - 1)].focus(),
      ArrowDown: () => items[Math.min(items.length - 1, at + 1)].focus(),
      Home: () => items[0].focus(),
      End: () => items.at(-1)?.focus(),
      ArrowRight: () => {
        if (item.dataset.group && !expanded.has(item.dataset.group)) {
          expanded.add(item.dataset.group);
          showTree();
        } else if (item.dataset.group) {
          items[at + 1]?.focus();
        }
      },
      ArrowLeft: () => {
        if (item.dataset.group) {
          expanded.delete(item.dataset.group);
          showTree();
        } else if (groupId) {
          groupHeads.get(groupId)?.focus();
        }
      },
    };
    const act = moves[event.key];
    if (!act) return;
    event.preventDefault();
    // The dialog's, not the page's.
    event.stopPropagation();
    act();
  });

  // On a phone the tree is two rows over the pane: a group picker, then
  // that group's sections in a strip that scrolls sideways.
  const narrow = element('div', 'settings-narrow');
  const picker = element('select', 'settings-group-picker');
  picker.setAttribute('aria-label', 'Settings group');
  for (const g of tree) picker.append(new Option(g.name, g.id));
  picker.addEventListener('change', () => {
    const to = tree.find(g => g.id === picker.value);
    if (to) chooseSection(to, to.sections[0]);
  });
  const strip = element('div', 'settings-strip');
  strip.setAttribute('aria-label', 'Sections');
  narrow.append(picker, strip);

  // The pane: its heading, then the glass with the section's lines.
  const pane = element('section', 'settings-pane');
  const heading = element('h2', 'settings-pane-heading');
  heading.id = 'settings-pane-heading';
  pane.setAttribute('aria-labelledby', heading.id);
  const screen = element('div', 'screen-bezel settings-screen');
  const glass = element('div', 'settings-glass');
  const rows = all.map((line, i) => {
    const row = element('div', 'settings-line');
    row.id = `settings-line-${i}`;
    row.tabIndex = -1;
    if (line.readout) {
      // Read only: no control, its value in its name for a screen reader.
      row.classList.add('is-readout');
    } else {
      row.setAttribute('role', 'spinbutton');
      row.setAttribute('aria-label', line.name);
      row.setAttribute('aria-haspopup', 'listbox');
      row.setAttribute('aria-expanded', 'false');
      const help = 'Left and Right change it; Enter opens its list; Delete puts it back to its default';
      row.setAttribute('aria-description', line.description ? `${line.description}. ${help}` : help);
    }
    const name = element('span', 'settings-name', line.name);
    name.setAttribute('aria-hidden', 'true');
    if (line.key) {
      // The label resets its field (the settings philosophy): a double
      // click, or on a touch screen a long press; staged as any change.
      name.title = 'Double-click to reset';
      name.classList.add('is-resettable');
      const reset = () => {
        select(i);
        draft = resetField(draft, line.key!);
        show();
      };
      name.addEventListener('dblclick', reset);
      let timer: number | undefined;
      name.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'touch') return;
        timer = window.setTimeout(reset, LONG_PRESS_MS);
      });
      for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
        name.addEventListener(type, () => window.clearTimeout(timer));
      }
    }
    const edit = element('span', 'settings-edit');
    edit.setAttribute('aria-hidden', 'true');
    const back = button('settings-arrow', '‹');
    const on = button('settings-arrow', '›');
    const value = element('span', 'settings-value');
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
    row.append(name, edit);
    row.addEventListener('click', event => {
      if (line.readout) return;
      if (event.target instanceof Element && event.target.closest('.settings-arrow')) return;
      select(i);
      row.focus({ preventScroll: true });
      if (event.target instanceof Element && event.target.closest('.settings-value')) toggleMenu();
    });
    return { row, value, back, on };
  });
  // One page of lines a section, all in the glass's one cell, the others
  // unseen: the glass keeps the longest one's size whichever is shown.
  const pages = new Map(
    tree.flatMap(g =>
      g.sections.map(s => {
        const page = element('div', 'settings-page');
        page.setAttribute('role', 'group');
        page.setAttribute('aria-labelledby', heading.id);
        page.append(...rows.filter((_, i) => all[i].section === s).map(r => r.row));
        return [s, page] as const;
      }),
    ),
  );
  glass.append(...pages.values());
  screen.append(glass);
  pane.append(heading, screen);

  // The foot: a failed save said once, quietly; then OK, Apply, Cancel.
  const foot = element('div', 'settings-foot');
  const notice = element('p', 'settings-notice', 'Settings could not be saved on this browser: they last for this visit.');
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  const actions = element('span', 'lamp-keys settings-actions');
  const ok = button('lamp-key settings-ok', 'OK');
  const apply = button('lamp-key settings-apply', 'Apply');
  const cancel = button('lamp-key settings-cancel', 'Cancel');
  actions.append(ok, apply, cancel);
  foot.append(notice, actions);

  const body = element('div', 'settings-body');
  body.append(treeNav, narrow, pane);
  dialog.append(head, body, foot);
  document.body.append(dialog);

  /** The lines of the shown section that can be set, by index. */
  const shown = () => all.flatMap((line, i) => (line.section === section && !line.readout ? [i] : []));
  /** The line `by` along from the selected one in the section, round its ends. */
  const along = (by: number) => {
    const lines = shown();
    return lines[round(lines.indexOf(selected), by, lines.length)];
  };

  function showTree(): void {
    for (const g of tree) {
      const open = expanded.has(g.id);
      const head = groupHeads.get(g.id)!;
      head.setAttribute('aria-expanded', String(open));
      head.querySelector('.settings-tree-mark')!.textContent = open ? '▾' : '▸';
      groupLists.get(g.id)!.hidden = !open;
      for (const s of g.sections) {
        const item = sectionKeys.get(s)!;
        const current = s === section;
        item.classList.toggle('is-current', current);
        if (current) item.setAttribute('aria-current', 'true');
        else item.removeAttribute('aria-current');
      }
    }
    picker.value = group.id;
    strip.replaceChildren(
      ...group.sections.map(s => {
        const item = button('settings-strip-section', s.name);
        item.classList.toggle('is-current', s === section);
        if (s === section) item.setAttribute('aria-current', 'true');
        item.addEventListener('click', () => chooseSection(group, s));
        return item;
      }),
    );
  }

  function showSection(): void {
    heading.textContent = paneHeading(group, section);
    for (const [s, page] of pages) {
      const on = s === section;
      page.classList.toggle('is-closed', !on);
      page.inert = !on;
    }
  }

  /** Shows a section, its group opened, its first line selected; the glass glitches over the change. */
  function chooseSection(to: TreeGroup, s: TreeSection, glitch = true): void {
    const changed = s !== section;
    group = to;
    section = s;
    expanded.add(to.id);
    closeMenu(false);
    showTree();
    showSection();
    select(shown()[0]);
    if (changed && glitch) glitchScreens([glass]);
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

  function show(): void {
    rows.forEach(({ row, value, back, on }, i) => {
      const line = all[i];
      if (line.readout) {
        const text = line.readout();
        value.textContent = text;
        row.setAttribute('aria-label', `${line.name}: ${text}`);
        return;
      }
      const label = labelOf(line);
      const index = at(line);
      const count = line.choices().length;
      value.textContent = label;
      // The whole of a long one (an input's name), cut short on the line.
      value.title = label;
      row.classList.toggle('is-selected', i === selected);
      // Changed and not yet saved: marked, as REAPER does not, but the glass can.
      row.classList.toggle('is-staged', line.key !== undefined && draft[line.key] !== settings.get()[line.key]);
      row.tabIndex = i === selected ? 0 : -1;
      row.setAttribute('aria-valuetext', label);
      row.setAttribute('aria-valuenow', String(Math.max(0, index)));
      row.setAttribute('aria-valuemin', '0');
      row.setAttribute('aria-valuemax', String(count - 1));
      back.classList.toggle('is-end', index <= 0);
      on.classList.toggle('is-end', index >= count - 1);
    });
    apply.disabled = !draftDiffers(draft, settings.get());
  }
  const select = (i: number) => {
    if (i !== selected) closeMenu(false);
    selected = i;
    show();
    rows[selected].row.scrollIntoView({ block: 'nearest' });
  };
  const focusLine = () => rows[selected].row.focus({ preventScroll: true });

  glass.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const line = all[selected];
    const handled: Record<string, () => void> = {
      ArrowUp: () => select(along(-1)),
      ArrowDown: () => select(along(1)),
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      Home: () => select(shown()[0]),
      End: () => select(shown().at(-1) ?? selected),
      Enter: () => openMenu(),
      ' ': () => openMenu(),
      // The label's reset from the keyboard.
      Delete: () => {
        if (line.key) stage(resetField(draft, line.key));
      },
    };
    const act = handled[event.key];
    if (!act) return;
    event.preventDefault();
    // The dialog's, not the page's: the space bar does not play here.
    event.stopPropagation();
    act();
    if (!menuOpen()) focusLine();
  });

  // The drop-down (Jeremy, 2026-10-23): a list on VFD glass under the
  // line, over the screen, scrolling inside itself, never past the case
  // or the window. Up, Down, Home, End, Page Up and Down move; Enter,
  // Space or a click choose and close it; Esc, Tab or a press elsewhere
  // close it as it was. Focus goes back to the line; the note keys still play.
  const menu = element('div', 'settings-menu');
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
        const option = element('div', 'settings-menu-option', c.label);
        option.id = `settings-menu-${i}`;
        option.setAttribute('role', 'option');
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
    if (menuOpen() || all[selected].readout) return;
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

  /** A failed save, said on the dialog once a visit. */
  let told = false;
  const tellSaveFailed = () => {
    if (told || !settingsSaveFailed()) return;
    notice.hidden = false;
  };

  /** Saves what is staged; the page follows at once. */
  const save = () => {
    if (draftDiffers(draft, settings.get())) settings.set({ ...draft });
    tellSaveFailed();
    show();
  };

  let opener: HTMLButtonElement = key;
  const isOpen = () => dialog.open;
  /** Opens at `at`'s group, expanded, its first section; the other groups closed. */
  const open = (at: TreeGroup['id'], from: HTMLButtonElement) => {
    if (isOpen()) return;
    opener = from;
    draft = { ...settings.get() };
    const to = tree.find(g => g.id === at) ?? tree[0];
    expanded.clear();
    chooseSection(to, to.sections[0], false);
    tellSaveFailed();
    dialog.showModal();
    for (const one of [key, gear]) one.setAttribute('aria-expanded', String(one === from));
    key.setAttribute('aria-pressed', String(from === key));
    focusLine();
  };
  /** Closes, throwing away what is staged (Cancel, Esc, Close), or after OK saved it. */
  const shut = () => {
    if (isOpen()) dialog.close();
  };
  dialog.addEventListener('close', () => {
    closeMenu(false);
    draft = { ...settings.get() };
    if (!notice.hidden) told = true;
    notice.hidden = true;
    for (const one of [key, gear]) one.setAttribute('aria-expanded', 'false');
    key.setAttribute('aria-pressed', 'false');
    opener.focus({ preventScroll: true });
  });
  // Esc is Cancel: the dialog's own cancel, unless a drop-down takes it first.
  dialog.addEventListener('cancel', event => {
    if (menuOpen()) {
      event.preventDefault();
      closeMenu();
    }
  });
  key.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    // Not the press's own focusing, which would take focus from the screen.
    event.preventDefault();
    if (isOpen()) shut();
    else open('synth', key);
  });
  key.addEventListener('click', event => {
    if (event.detail === 0) {
      if (isOpen()) shut();
      else open('synth', key);
    }
  });
  gear.addEventListener('click', () => open('general', gear));
  ok.addEventListener('click', () => {
    save();
    shut();
  });
  apply.addEventListener('click', save);
  cancel.addEventListener('click', shut);
  close.addEventListener('click', shut);
  // A click on the dimmed page round the case is Cancel.
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) shut();
  });
  // Opened from the synth, leaving it shuts it (the other way, too).
  let wasSandbox = inSandbox();
  new MutationObserver(() => {
    if (inSandbox() !== wasSandbox) shut();
    wasSandbox = inSandbox();
  }).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });

  // The Input line's choices come and go with the inputs; Last velocity
  // with each MIDI note.
  const refresh = () => {
    if (!isOpen()) return;
    if (menuOpen()) {
      fillMenu();
      markMenu();
    }
    show();
  };
  midiInputs.subscribe(refresh);
  midiLast.subscribe(refresh);
  settings.subscribe(refresh);
  showTree();
  showSection();
  show();
}
