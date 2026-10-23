// The Reverb tab key's light as a switch of its own (Jeremy, 2026-10-23):
// a press on it turns the reverb on or off, whichever tab is open, and
// opens no tab; a press anywhere else on the key opens the tab as before.
// A button cannot sit inside the tab's button, so the light's switch is
// a sibling, unseen, laid over the light: a 20px square round it, so it
// is not fiddly to hit. It is the On key in the Reverb tab by another
// way in: both are the `reverb` setting.

import { settings } from '../model/settings';

/** The switch's square, in CSS pixels, centred on the light. */
export const LAMP_HIT = 20;

type Box = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

/** Where the switch goes in `holder`'s box: its square centred on `light`. */
export function lampPlace(holder: Box, light: Box): { left: number; top: number } {
  return {
    left: light.left + light.width / 2 - holder.left - LAMP_HIT / 2,
    top: light.top + light.height / 2 - holder.top - LAMP_HIT / 2,
  };
}

/** The reverb after a press on the switch. */
export const flipped = (reverb: 'on' | 'off'): 'on' | 'off' => (reverb === 'on' ? 'off' : 'on');

/**
 * Lays a switch over `tab`'s light (its `.pill-mark`), a child of
 * `holder`, which it is placed in. Returns the switch.
 */
export function mountReverbLamp(holder: HTMLElement, tab: HTMLElement): HTMLButtonElement | null {
  const mark = tab.querySelector<HTMLElement>('.pill-mark');
  if (!mark) return null;
  const lamp = document.createElement('button');
  lamp.type = 'button';
  lamp.className = 'reverb-lamp';
  lamp.setAttribute('aria-label', 'Reverb');
  // Not a tab: the tablist's arrows pass it by; Tab reaches it, after the tabs.
  holder.append(lamp);

  const show = () => {
    const on = settings.get().reverb === 'on';
    lamp.setAttribute('aria-pressed', String(on));
    lamp.title = on ? 'Reverb on' : 'Reverb off';
  };
  /** Over the light, wherever the key is laid out. */
  const place = () => {
    const { left, top } = lampPlace(holder.getBoundingClientRect(), mark.getBoundingClientRect());
    lamp.style.left = `${left}px`;
    lamp.style.top = `${top}px`;
  };

  const flip = () => settings.set({ reverb: flipped(settings.get().reverb) });
  // On the press, as every key here; not the press's own focusing, so a
  // click leaves no ring. Enter and Space work it through the click.
  lamp.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    flip();
  });
  lamp.addEventListener('click', event => {
    if (event.detail === 0) flip();
  });

  settings.subscribe((now, before) => {
    if (now.reverb !== before.reverb) show();
  });
  if (typeof ResizeObserver === 'function') {
    const watch = new ResizeObserver(place);
    watch.observe(holder);
    watch.observe(tab);
  }
  window.addEventListener('resize', place);
  show();
  place();
  return lamp;
}
