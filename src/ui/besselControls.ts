import { INDEX, type LabState, type LabStore } from '../model/lab';
import { indexAt, MAX_ORDER, orderAt, orderLabel } from '../viz/besselPlot';
import { orderAtX } from '../viz/spectrumPlot';

/** The index at which J_0 first reaches zero, and the carrier is gone. */
export const CARRIER_VANISHES = 2.405;

/** How far a key moves the index line. */
const KEY_STEP = 0.05;
const PAGE_STEP = 0.5;

/** The index as the Bessel plot's readout and screen readers say it. */
export function indexText(index: number): string {
  // Up to three decimals, so 2.405 reads as itself and 2 as "2.00".
  return Number.isInteger(index * 100)
    ? index.toFixed(2)
    : String(Number(index.toFixed(3)));
}

/**
 * The index a key moves the line to, or null for a key that does not move
 * it. The keys are the ones a native slider answers to.
 */
export function indexAfterKey(index: number, key: string): number | null {
  const moves: Record<string, number> = {
    ArrowRight: index + KEY_STEP,
    ArrowUp: index + KEY_STEP,
    ArrowLeft: index - KEY_STEP,
    ArrowDown: index - KEY_STEP,
    PageUp: index + PAGE_STEP,
    PageDown: index - PAGE_STEP,
    Home: INDEX.min,
    End: INDEX.max,
  };
  if (!(key in moves)) return null;
  const moved = Math.min(INDEX.max, Math.max(INDEX.min, moves[key]));
  // Hundredths: no 2.4000000000000004 after a few presses.
  return Math.round(moved * 100) / 100;
}

/**
 * The Bessel plot as a control. The plot itself is a slider for the
 * index: drag the line, or focus the plot and use the keys. Pointing at a
 * curve, a stem of the spectrum, or one of the J buttons under the plot
 * picks that sideband order out in both figures; pressing a J button
 * keeps it picked out. A further button sets the index at which the
 * carrier vanishes.
 */
export function mountBesselControls(store: LabStore): void {
  const plot = document.querySelector<HTMLCanvasElement>('#bessel');
  const spectrum = document.querySelector<HTMLCanvasElement>('#spectrum');
  const chips = document.querySelector<HTMLElement>('#bessel-orders');
  const vanish = document.querySelector<HTMLButtonElement>('#vanish');

  if (plot) {
    const position = (event: PointerEvent) => {
      const box = plot.getBoundingClientRect();
      return { box, x: event.clientX - box.left, y: event.clientY - box.top };
    };
    let dragging = false;

    plot.addEventListener('pointerdown', event => {
      dragging = true;
      plot.setPointerCapture(event.pointerId);
      const { box, x } = position(event);
      store.set({ index: indexAt(box.width, x), hover: null });
    });
    plot.addEventListener('pointermove', event => {
      const { box, x, y } = position(event);
      if (dragging) store.set({ index: indexAt(box.width, x) });
      else store.set({ hover: orderAt(box.width, box.height, x, y) });
    });
    const release = () => {
      dragging = false;
    };
    plot.addEventListener('pointerup', release);
    plot.addEventListener('pointercancel', release);
    plot.addEventListener('pointerleave', () => store.set({ hover: null }));

    plot.addEventListener('keydown', event => {
      const index = indexAfterKey(store.get().index, event.key);
      if (index === null) return;
      // Or the arrows would scroll the page as well.
      event.preventDefault();
      store.set({ index });
    });

    // What a slider owes a screen reader.
    plot.setAttribute('aria-valuemin', String(INDEX.min));
    plot.setAttribute('aria-valuemax', String(INDEX.max));
    const describe = (state: LabState) => {
      plot.setAttribute('aria-valuenow', String(state.index));
      plot.setAttribute('aria-valuetext', `index ${indexText(state.index)}`);
    };
    store.subscribe((state, previous) => {
      if (state.index !== previous.index) describe(state);
    });
    describe(store.get());
  }

  if (spectrum) {
    // Only where there is a Bessel plot to link to; elsewhere the
    // spectrum's stems are not single sidebands.
    const linked = () => plot !== null && plot.closest('[hidden]') === null;
    spectrum.addEventListener('pointermove', event => {
      if (!linked()) return;
      const box = spectrum.getBoundingClientRect();
      const x = event.clientX - box.left;
      store.set({ hover: orderAtX(store.get(), box.width, x, MAX_ORDER) });
    });
    spectrum.addEventListener('pointerleave', () => store.set({ hover: null }));
  }

  if (chips) {
    for (let order = 0; order <= MAX_ORDER; order++) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = orderLabel(order);
      chip.setAttribute(
        'aria-label',
        order === 0 ? 'J0, the carrier' : `J${order}, sideband pair ${order}`,
      );
      chip.setAttribute('aria-pressed', 'false');

      const point = () => store.set({ hover: order });
      const leave = () => store.set({ hover: null });
      chip.addEventListener('pointerenter', point);
      chip.addEventListener('pointerleave', leave);
      chip.addEventListener('focus', point);
      chip.addEventListener('blur', leave);
      chip.addEventListener('click', () => {
        store.set({ pinned: store.get().pinned === order ? null : order });
      });
      store.subscribe((state, previous) => {
        if (state.pinned !== previous.pinned) {
          chip.setAttribute('aria-pressed', String(state.pinned === order));
        }
      });
      chips.append(chip);
    }
  }

  vanish?.addEventListener('click', () => {
    store.set({ index: CARRIER_VANISHES });
  });
}
