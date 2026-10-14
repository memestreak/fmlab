import type { LabStore } from '../model/lab';
import { dragHandle, handleAt, type HandleId } from '../viz/envelopePlot';

/**
 * Makes the envelope figure's three dots draggable. Pressing on or near a
 * dot takes hold of it; moving sets the attack, the decay and sustain, or
 * the release, as the Attack, Decay, Sustain and Release sliders do. The
 * sliders are the keyboard's way to the same four numbers.
 */
export function mountEnvelopeControls(store: LabStore): void {
  const plot = document.querySelector<HTMLCanvasElement>('#envelope');
  if (!plot) return;

  const position = (event: PointerEvent) => {
    const box = plot.getBoundingClientRect();
    return { box, x: event.clientX - box.left, y: event.clientY - box.top };
  };
  let held: HandleId | null = null;

  plot.addEventListener('pointerdown', event => {
    const { box, x, y } = position(event);
    held = handleAt(store.get(), box.width, box.height, x, y);
    if (held) plot.setPointerCapture(event.pointerId);
  });
  plot.addEventListener('pointermove', event => {
    const { box, x, y } = position(event);
    if (held) {
      store.set(dragHandle(store.get(), held, box.width, box.height, x, y));
    } else {
      // Say which way a dot can go before it is pressed.
      const over = handleAt(store.get(), box.width, box.height, x, y);
      plot.style.cursor = over === null ? '' : over === 'sustain' ? 'move' : 'ew-resize';
    }
  });
  const release = () => {
    held = null;
  };
  plot.addEventListener('pointerup', release);
  plot.addEventListener('pointercancel', release);
}
