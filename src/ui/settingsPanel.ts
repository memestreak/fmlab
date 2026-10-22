import {
  type ChoiceSetting,
  type NumberSetting,
  saveSettings,
  SETTING_RANGES,
  type Settings,
  settings,
  stepSetting,
} from '../model/settings';
import { tapeLabel } from './dymo';
import { inSandbox } from './motion';

// The sandbox's Settings (Jeremy, 2026-10-21, "a function panel, named
// SETTINGS"): a push key in the masthead opens a modal console, a VFD
// screen listing every setting, one line each, the selected one's
// choices as lamp keys under it. Changes apply as they are made and are
// saved (model/settings.ts). No theme: the sandbox is dark only
// (Jeremy, 2026-10-22).

/** A line of choices: its group, its name, its choices and how to read and set it. */
interface ChoiceLine {
  kind: 'choice';
  group: string;
  name: string;
  choices: readonly { value: string; label: string }[];
  get: () => string;
  set: (value: string) => void;
}

/**
 * A line that is a number in a range (the reverb's Decay, Mix and Tone;
 * Jeremy, 2026-10-22): stepped by Left and Right, or the minus and plus
 * keys under the glass, held at its ends; written as `text` says, and
 * said as `spoken` says.
 */
interface NumberLine {
  kind: 'number';
  group: string;
  name: string;
  key: NumberSetting;
  text: (value: number) => string;
  spoken: (value: number) => string;
  get: () => number;
  step: (steps: number) => void;
}

/** One line of the panel: a setting. */
type Line = ChoiceLine | NumberLine;

/** How many steps Shift takes at once on a number line. */
const SHIFT_STEPS = 10;
/** A minus or plus key held: it repeats after this long, then this often, in ms. */
const REPEAT_AFTER_MS = 400;
const REPEAT_EVERY_MS = 60;

const choice = (value: string, label: string) => ({ value, label });

/** The lines, in order; each one a setting. */
function lines(): Line[] {
  const setting = <K extends ChoiceSetting>(
    group: string,
    name: string,
    key: K,
    labels: Record<Settings[K], string>,
  ): ChoiceLine => ({
    kind: 'choice',
    group,
    name,
    choices: (Object.keys(labels) as Settings[K][]).map(value => choice(value, labels[value])),
    get: () => settings.get()[key],
    set: value => settings.set({ [key]: value } as Partial<Settings>),
  });
  const number = (
    group: string,
    name: string,
    key: NumberSetting,
    text: (value: number) => string,
    spoken: (value: number) => string,
  ): NumberLine => ({
    kind: 'number',
    group,
    name,
    key,
    text,
    spoken,
    get: () => settings.get()[key],
    step: steps => settings.set({ [key]: stepSetting(key, settings.get()[key], steps) }),
  });
  return [
    setting('Screens', 'Screen glitch', 'screenGlitch', { on: 'On', off: 'Off' }),
    setting('Screens', 'Motion', 'motion', { system: 'System', still: 'Still' }),
    setting('Help', 'Tips on hover', 'tips', { on: 'On', off: 'Off' }),
    setting('Help', 'Z X hint', 'zxHint', { hover: 'Hover', always: 'Always', off: 'Off' }),
    setting('Keyboard', 'Note names', 'noteNames', { c: 'C only', all: 'All', off: 'Off' }),
    setting('Keyboard', 'Computer keys', 'computerKeys', { off: 'Off', on: 'On' }),
    setting('Controls', 'Wheel', 'wheel', { page: 'Page', reverse: 'Reverse' }),
    setting('Reverb', 'Reverb', 'reverb', { off: 'Off', on: 'On' }),
    number('Reverb', 'Decay', 'reverbDecay', v => `${v.toFixed(1)} s`, v => `${v.toFixed(1)} seconds`),
    number('Reverb', 'Mix', 'reverbMix', v => `${v} %`, v => `${v} percent`),
    number('Reverb', 'Tone', 'reverbTone', v => String(v), v => String(v)),
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
    if (line.kind === 'number') {
      // Its value a slider for screen readers, its range and its words.
      const { min, max } = SETTING_RANGES[line.key];
      value.setAttribute('role', 'slider');
      value.setAttribute('aria-label', line.name);
      value.setAttribute('aria-valuemin', String(min));
      value.setAttribute('aria-valuemax', String(max));
      value.classList.add('is-number');
    }
    row.append(group, name, value);
    // A click selects the line; on a choice's value, it also turns it to
    // its next choice (a number's does nothing).
    row.addEventListener('click', event => {
      select(i);
      if (line.kind === 'choice' && event.target instanceof Element && event.target.closest('.settings-value')) cycle(1);
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

  const labelOf = (line: Line) =>
    line.kind === 'number' ? line.text(line.get()) : (line.choices.find(c => c.value === line.get())?.label ?? '');
  /**
   * Moves the line's value `by` on: a choice's by choices (Enter, Space, a
   * click), round or held at the ends; a number's by steps, held there.
   */
  const cycle = (by: number, wrap = true) => {
    const line = all[selected];
    if (line.kind === 'number') {
      line.step(by);
      return;
    }
    const at = line.choices.findIndex(c => c.value === line.get());
    const to = wrap ? round(at, by, line.choices.length) : Math.min(line.choices.length - 1, Math.max(0, at + by));
    if (to !== at) line.set(line.choices[to].value);
  };
  /** A minus or plus key held: the timer repeating it. */
  let repeat: number | undefined;
  const stopRepeat = () => {
    window.clearTimeout(repeat);
    window.clearInterval(repeat);
    repeat = undefined;
  };
  /** A number line's minus and plus: the choosers' black keys, no lamps; repeating while held. */
  const stepKey = (line: NumberLine, label: string, glyph: string, by: number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chooser-key';
    button.textContent = glyph;
    button.setAttribute('aria-label', `${label} ${line.name}`);
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      line.step(by);
      stopRepeat();
      repeat = window.setTimeout(() => {
        repeat = window.setInterval(() => line.step(by), REPEAT_EVERY_MS);
      }, REPEAT_AFTER_MS);
    });
    for (const end of ['pointerup', 'pointerleave', 'pointercancel', 'blur'] as const) {
      button.addEventListener(end, stopRepeat);
    }
    button.addEventListener('click', event => {
      if (event.detail === 0) line.step(by);
    });
    return button;
  };
  const buildChoices = () => {
    stopRepeat();
    const line = all[selected];
    options.setAttribute('aria-label', line.name);
    if (line.kind === 'number') {
      options.className = 'chooser settings-choices';
      options.setAttribute('role', 'group');
      options.replaceChildren(stepKey(line, 'Less', '−', -1), stepKey(line, 'More', '+', 1));
      return;
    }
    options.className = 'lamp-keys settings-choices';
    options.setAttribute('role', 'radiogroup');
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
      if (line.kind === 'number') {
        value.setAttribute('aria-valuenow', String(line.get()));
        value.setAttribute('aria-valuetext', line.spoken(line.get()));
        row.setAttribute('aria-label', `${line.name}: ${line.spoken(line.get())}`);
      } else {
        row.setAttribute('aria-label', `${line.name}: ${labelOf(line)}`);
      }
    });
    glass.setAttribute('aria-activedescendant', rows[selected].row.id);
    legend.textContent = all[selected].name;
    const line = all[selected];
    if (line.kind === 'number') return;
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
      // Shift on a number line: ten steps at a time.
      ArrowLeft: () => cycle(event.shiftKey && all[selected].kind === 'number' ? -SHIFT_STEPS : -1, false),
      ArrowRight: () => cycle(event.shiftKey && all[selected].kind === 'number' ? SHIFT_STEPS : 1, false),
      Home: () => select(0),
      End: () => select(all.length - 1),
      // On a number line, Enter and Space do nothing (and the space bar
      // still does not play).
      Enter: () => all[selected].kind === 'choice' && cycle(1),
      ' ': () => all[selected].kind === 'choice' && cycle(1),
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
    stopRepeat();
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
  buildChoices();
  show();
}
