import type { Preset, PresetBank } from '../chapters/types';
import { inSandbox } from './motion';
import { bankVoices, gridMove, openingBank, stepPreset } from './presetGrid';
import { glitchScreens } from './screenGlitch';

// The sandbox's preset window (Jeremy, 2026-10-22, "more consistent with
// the settings UI ... use a modal window. The bank buttons can be moved to
// this new window"): the voice's name in the title bar opens a modal
// console in the Settings case, its bank keys A | B, a VFD glass showing
// the shown bank's 32 voices in four columns of eight, and under it ‹ ›
// with the bank's credit. A bank key only shows its bank: it never changes
// the sound. A press on a voice loads it, and the window stays open, so
// voices can be heard one after another. The arrows go through all 64,
// across the banks; the glass glitches as it turns to the other bank.
// Every label in it is silkscreen.

export interface PresetPanel {
  open: () => void;
  shut: () => void;
  isOpen: () => boolean;
  /** Draws the window again from the sound now (the lit voice, the legend). */
  show: () => void;
}

interface Options {
  presets: readonly Preset[];
  banks: readonly PresetBank[];
  /** The voice playing: an index into `presets`, or -1 once edited. */
  playing: () => number;
  /** The voice last chosen, which the steps go on from. */
  last: () => number;
  /** Loads a voice; `glitch` are screens to glitch with the top two. */
  choose: (at: number, glitch: readonly HTMLElement[]) => void;
  /** The name in the title bar: it opens the window and has focus back. */
  opener: HTMLElement;
  /** The credit for voices with no bank of their own. */
  credit: string;
}

/** The window mounted last, taken down when the sandbox is drawn again. */
let mounted: { dialog: HTMLDialogElement; observer: MutationObserver } | null = null;

/** Two columns of 16 on a phone, four of eight elsewhere. */
const rowsNow = () => (window.matchMedia('(max-width: 30rem)').matches ? 16 : 8);

/** The voice's name without its bank and number: "A11 E.PIANO 1" is "E.PIANO 1". */
const bare = (label: string) => label.replace(/^\S+\s+/, '');

/** Builds the preset window, shut, at the end of the page. */
export function mountPresetPanel({ presets, banks, playing, last, choose, opener, credit }: Options): PresetPanel {
  if (mounted) {
    mounted.observer.disconnect();
    mounted.dialog.remove();
  }
  /** The bank on the glass: not the sound's, until a voice is chosen. */
  let shown = openingBank(presets, playing(), last());

  const dialog = document.createElement('dialog');
  dialog.id = 'preset-panel';
  dialog.className = 'settings-panel preset-panel';
  dialog.setAttribute('aria-label', 'Presets');

  // The head: the title, the bank keys, and Close at the right.
  const head = document.createElement('div');
  head.className = 'settings-head preset-head';
  const title = document.createElement('span');
  title.className = 'preset-title';
  title.textContent = 'Presets';
  title.setAttribute('aria-hidden', 'true');
  const bankRow = document.createElement('span');
  bankRow.className = 'preset-bank-row';
  const bankLegend = document.createElement('span');
  bankLegend.className = 'preset-legend';
  bankLegend.textContent = 'Bank';
  bankLegend.setAttribute('aria-hidden', 'true');
  const bankGroup = document.createElement('span');
  bankGroup.className = 'lamp-keys preset-banks';
  bankGroup.setAttribute('role', 'group');
  bankGroup.setAttribute('aria-label', 'Bank');
  const bankKeys = banks.map(bank => {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'lamp-key';
    key.textContent = bank.id;
    key.setAttribute('aria-label', `Bank ${bank.id}: ${bank.name}`);
    // On the press, as every push key; Enter and Space through the click.
    key.addEventListener('pointerdown', event => {
      if (event.button === 0) showBank(bank.id);
    });
    key.addEventListener('click', event => {
      if (event.detail === 0) showBank(bank.id);
    });
    return key;
  });
  bankGroup.append(...bankKeys);
  bankRow.append(bankLegend, bankGroup);
  const closeBezel = document.createElement('span');
  closeBezel.className = 'lamp-keys preset-close-bezel';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'lamp-key settings-close';
  close.textContent = 'Close';
  closeBezel.append(close);
  head.append(title, ...(banks.length > 0 ? [bankRow] : []), closeBezel);

  // The glass: a listbox of the shown bank's voices, numbered down the columns.
  const screen = document.createElement('div');
  screen.className = 'screen-bezel settings-screen preset-screen';
  const glass = document.createElement('div');
  glass.className = 'settings-glass preset-glass';
  glass.tabIndex = 0;
  glass.setAttribute('role', 'listbox');
  glass.setAttribute('aria-label', 'Voices');
  screen.append(glass);

  // Under the glass: ‹ › through all the voices, then the bank's credit.
  const steps = document.createElement('span');
  steps.className = 'chooser settings-steps';
  const step = (label: string, glyph: string, by: number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chooser-key';
    button.textContent = glyph;
    button.setAttribute('aria-label', label);
    const go = () => load(stepPreset(last(), by, presets.length));
    button.addEventListener('pointerdown', event => {
      if (event.button === 0) go();
    });
    button.addEventListener('click', event => {
      if (event.detail === 0) go();
    });
    return button;
  };
  steps.append(step('Previous preset', '‹', -1), step('Next preset', '›', 1));
  const legend = document.createElement('span');
  legend.className = 'preset-legend preset-credit';
  const controls = document.createElement('div');
  controls.className = 'settings-controls preset-controls';
  controls.append(steps, legend);

  dialog.append(head, screen, controls);
  document.body.append(dialog);

  /** The cells on the glass now, with the voice each is. */
  let cells: { cell: HTMLElement; at: number }[] = [];
  /** Puts the shown bank's voices on the glass. */
  const fill = () => {
    cells = bankVoices(presets, shown).map((at, i) => {
      const cell = document.createElement('div');
      cell.className = 'preset-cell';
      cell.id = `preset-voice-${at}`;
      cell.setAttribute('role', 'option');
      cell.setAttribute('aria-label', presets[at].label);
      const number = document.createElement('span');
      number.className = 'preset-number';
      number.textContent = String(i + 1);
      const name = document.createElement('span');
      name.textContent = bare(presets[at].label);
      cell.append(number, name);
      // On the press: the voice loads and the window stays open.
      cell.addEventListener('pointerdown', event => {
        if (event.button === 0) load(at);
      });
      return { cell, at };
    });
    glass.replaceChildren(...cells.map(c => c.cell));
  };

  const show = () => {
    const now = playing();
    let active: HTMLElement | null = null;
    for (const { cell, at } of cells) {
      const on = at === now;
      cell.setAttribute('aria-selected', String(on));
      if (on) active = cell;
    }
    if (active) glass.setAttribute('aria-activedescendant', active.id);
    else glass.removeAttribute('aria-activedescendant');
    bankKeys.forEach((key, i) => key.setAttribute('aria-pressed', String(banks[i].id === shown)));
    const bank = banks.find(b => b.id === shown);
    const note = now >= 0 && presets[now].bank === shown ? presets[now].note : undefined;
    legend.textContent = [bank?.name ?? credit, ...(note ? [note] : [])].join(' · ');
  };

  /** Turns the glass to `bank`, glitching it; the sound stays as it is. */
  const showBank = (bank: string | undefined) => {
    if (bank === shown) return;
    shown = bank;
    fill();
    show();
    glitchScreens([glass]);
  };

  /**
   * Loads a voice, turning the glass to its bank if it is in the other;
   * then the glass glitches with the top two screens, each its own kind.
   */
  const load = (at: number) => {
    const bank = presets[at]?.bank;
    const turns = bank !== shown;
    if (turns) {
      shown = bank;
      fill();
    }
    choose(at, turns ? [glass] : []);
    show();
  };

  glass.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      shut();
      return;
    }
    const voices = bankVoices(presets, shown);
    const from = playing() >= 0 ? playing() : last();
    const to = gridMove(event.key, from, presets.length, rowsNow(), {
      first: voices[0] ?? 0,
      last: voices.at(-1) ?? presets.length - 1,
    });
    if (to === null) return;
    event.preventDefault();
    // The window's, not the page's.
    event.stopPropagation();
    load(to);
  });

  const isOpen = () => dialog.open;
  const open = () => {
    if (isOpen()) return;
    shown = openingBank(presets, playing(), last());
    fill();
    show();
    dialog.showModal();
    opener.setAttribute('aria-expanded', 'true');
    glass.focus({ preventScroll: true });
  };
  const shut = () => {
    if (isOpen()) dialog.close();
  };
  dialog.addEventListener('close', () => {
    opener.setAttribute('aria-expanded', 'false');
    opener.focus({ preventScroll: true });
  });
  close.addEventListener('click', shut);
  // A press and its release both on the dimmed page round the case close
  // it; a drag that starts inside and ends outside does not.
  const outside = (event: MouseEvent) => {
    if (event.target !== dialog) return false;
    const box = dialog.getBoundingClientRect();
    return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
  };
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', event => {
    pressedOutside = outside(event);
  });
  dialog.addEventListener('click', event => {
    if (pressedOutside && outside(event)) shut();
    pressedOutside = false;
  });
  // Leaving the sandbox shuts it.
  const observer = new MutationObserver(() => {
    if (!inSandbox()) shut();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
  mounted = { dialog, observer };

  fill();
  show();
  return { open, shut, isOpen, show };
}
