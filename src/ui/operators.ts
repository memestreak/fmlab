import { algorithm, algorithmsByCarriers, isDx7, operatorsUsed } from '../dsp/algorithms';
import type { Operator } from '../dsp/operators';
import {
  clamp,
  type LabState,
  type LabStore,
  OP_DECAY,
  OP_LEVEL,
  OP_RATIO,
} from '../model/lab';
import { operatorAt } from '../viz/algorithmPlot';

/** One column of the operator table: which number, and its controls' range. */
interface Column {
  key: keyof Operator;
  label: string;
  /** In the slider's units, which are the box's: Level in %. */
  min: number;
  max: number;
  step: number;
  /** The box shows the operator's value through this. */
  show: (value: number) => string;
  /** And reads the operator's value back from a slider or a box. */
  read: (shown: number) => number;
  /** What a screen reader hears the slider's value as. */
  say: (value: number) => string;
}

const COLUMNS: Column[] = [
  {
    // Fine steps, so a box or Shift can reach 1.41; a drag or an arrow
    // key without Shift snaps to RATIO_STOPS.
    key: 'ratio',
    label: 'Ratio',
    min: OP_RATIO.min,
    max: OP_RATIO.max,
    step: 0.01,
    show: value => String(Number(value.toFixed(2))),
    read: shown => clamp(shown, OP_RATIO),
    say: value => `ratio ${Number(value.toFixed(2))}`,
  },
  {
    // Shown as a percentage; held as 0 to 1.
    key: 'level',
    label: 'Level',
    min: OP_LEVEL.min * 100,
    max: OP_LEVEL.max * 100,
    step: 1,
    show: value => String(Math.round(value * 100)),
    read: shown => clamp(shown / 100, OP_LEVEL),
    say: value => `${Math.round(value * 100)}%`,
  },
  {
    key: 'decay',
    label: 'Decay',
    min: OP_DECAY.min,
    max: OP_DECAY.max,
    step: 0.1,
    show: value => String(Number(value.toFixed(2))),
    read: shown => clamp(shown, OP_DECAY),
    say: value =>
      value === 0 ? '0 seconds: holds for the whole note' : `${Number(value.toFixed(2))} seconds`,
  },
];

/**
 * The ratios a Ratio slider snaps to without Shift or Alt: a half, and
 * every whole number up to the top of the range, as the DX7's coarse
 * ratios are.
 */
export const RATIO_STOPS: readonly number[] = [
  0.5,
  ...Array.from({ length: OP_RATIO.max }, (_, i) => i + 1),
];

/** The stop nearest a ratio. */
export function snapRatio(ratio: number): number {
  return RATIO_STOPS.reduce((best, stop) =>
    Math.abs(stop - ratio) < Math.abs(best - ratio) ? stop : best,
  );
}

/**
 * The next stop up (`direction` 1) or down (-1) from a ratio, which may be
 * between stops; the end of the range if there is none further.
 */
export function stepRatio(ratio: number, direction: 1 | -1): number {
  const EPSILON = 1e-9;
  if (direction > 0) {
    return RATIO_STOPS.find(stop => stop > ratio + EPSILON) ?? OP_RATIO.max;
  }
  return [...RATIO_STOPS].reverse().find(stop => stop < ratio - EPSILON) ?? OP_RATIO.min;
}

/**
 * "carrier" or "modulator": what an operator is in an algorithm; "unused"
 * for one a step wiring leaves out.
 */
export function roleOf(
  algorithmNumber: number,
  op: number,
): 'carrier' | 'modulator' | 'unused' {
  const alg = algorithm(algorithmNumber);
  if (!operatorsUsed(alg).includes(op)) return 'unused';
  return alg.carriers.includes(op) ? 'carrier' : 'modulator';
}

/** What a group of the algorithm list is called: "1 carrier", "3 carriers". */
export function carriersLabel(count: number): string {
  return count === 1 ? '1 carrier' : `${count} carriers`;
}

/** Keys that move a slider, and which way. */
const STEP_KEYS: Record<string, 1 | -1> = {
  ArrowUp: 1,
  ArrowRight: 1,
  PageUp: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
  PageDown: -1,
};

/**
 * The six-operator lab of chapter 8 and the sandbox: the Algorithm panel's
 * list of all 32 (the diagram is a figure, and Feedback a slider), and the
 * Operators panel's table, a row per operator with its role and a slider
 * for each of ratio, level and decay, each with a box beside it to type a
 * value. Pointing at or focusing a row rings its box in the diagram, and
 * pointing at a box picks out its row.
 */
export function mountOperators(store: LabStore): void {
  const select = document.querySelector<HTMLSelectElement>('#algorithm');
  const table = document.querySelector<HTMLTableSectionElement>('#operators tbody');
  if (!select || !table) return;

  // The DX7's 32, grouped by how many carriers each has.
  for (const { carriers, numbers } of algorithmsByCarriers()) {
    const group = document.createElement('optgroup');
    group.label = carriersLabel(carriers);
    for (const number of numbers) {
      const option = document.createElement('option');
      option.value = String(number);
      option.textContent = String(number);
      group.append(option);
    }
    select.append(group);
  }
  select.addEventListener('change', () => {
    store.set({ algorithm: Number(select.value) });
  });

  const setOperator = (op: number, key: keyof Operator, value: number) => {
    const operators = store.get().operators.map((o, i) =>
      i === op ? { ...o, [key]: value } : o,
    );
    store.set({ operators });
  };
  const point = (op: number | null) => {
    if (store.get().hoverOp !== op) store.set({ hoverOp: op });
  };

  const rows: HTMLTableRowElement[] = [];
  const tags: HTMLElement[] = [];
  const roles: HTMLElement[] = [];
  const sliders: HTMLInputElement[][] = [];
  const boxes: HTMLInputElement[][] = [];
  for (let op = 0; op < 6; op++) {
    const row = document.createElement('tr');
    row.className = 'op-row';
    const name = document.createElement('th');
    name.scope = 'row';
    const tag = document.createElement('span');
    tag.className = 'op-tag';
    tag.textContent = `OP${op + 1}`;
    name.append(tag);
    const role = document.createElement('td');
    role.className = 'op-role';
    row.append(name, role);
    rows.push(row);
    tags.push(tag);
    roles.push(role);

    const pair = COLUMNS.map(column => {
      const cell = document.createElement('td');
      const param = document.createElement('div');
      param.className = 'op-param';
      const what = `OP${op + 1} ${column.label.toLowerCase()}`;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'slider op-slider';
      slider.min = String(column.min);
      slider.max = String(column.max);
      slider.step = String(column.step);
      slider.setAttribute('aria-label', what);

      const box = document.createElement('input');
      box.type = 'number';
      box.className = 'op-input num';
      box.min = String(column.min);
      box.max = String(column.max);
      box.step = String(column.step);
      box.setAttribute('aria-label', `${what}, typed`);

      // Ratio: Shift or Alt held means fine steps; otherwise a drag snaps
      // to the stops, and the arrow keys go from one stop to the next.
      let fine = false;
      if (column.key === 'ratio') {
        const hold = (event: PointerEvent | KeyboardEvent) => {
          fine = event.shiftKey || event.altKey;
        };
        slider.addEventListener('pointerdown', hold);
        slider.addEventListener('pointermove', hold);
        slider.addEventListener('keydown', event => {
          hold(event);
          const direction = STEP_KEYS[event.key];
          if (fine || !direction) return;
          event.preventDefault();
          setOperator(op, 'ratio', stepRatio(store.get().operators[op].ratio, direction));
        });
      }
      slider.addEventListener('input', () => {
        const shown = slider.valueAsNumber;
        const value = column.key === 'ratio' && !fine ? snapRatio(shown) : shown;
        setOperator(op, column.key, column.read(value));
      });

      box.addEventListener('input', () => {
        const typed = box.valueAsNumber;
        if (!Number.isFinite(typed)) return;
        setOperator(op, column.key, column.read(typed));
      });
      // Put a number typed out of range back into it, once left.
      box.addEventListener('change', () => show(store.get()));

      param.append(slider, box);
      cell.append(param);
      row.append(cell);
      return { slider, box };
    });
    sliders.push(pair.map(p => p.slider));
    boxes.push(pair.map(p => p.box));

    row.addEventListener('pointerenter', () => point(op));
    row.addEventListener('pointerleave', () => {
      if (store.get().hoverOp === op) point(null);
    });
    row.addEventListener('focusin', () => point(op));
    row.addEventListener('focusout', event => {
      if (!row.contains(event.relatedTarget as Node | null)) point(null);
    });
  }
  table.append(...rows);

  // Pointing at a box in the diagram picks out its row.
  const diagram = document.querySelector<HTMLCanvasElement>('#algorithm-plot');
  diagram?.addEventListener('pointermove', event => {
    const rect = diagram.getBoundingClientRect();
    point(
      operatorAt(
        store.get().algorithm,
        rect.width,
        rect.height,
        event.clientX - rect.left,
        event.clientY - rect.top,
      ),
    );
  });
  diagram?.addEventListener('pointerleave', () => point(null));

  const show = (state: LabState) => {
    select.value = String(state.algorithm);
    // A step's wiring is none of the 32: the list would show a blank. It
    // keeps its room, so that choosing All 32 moves nothing.
    select.style.visibility = isDx7(state.algorithm) ? '' : 'hidden';
    const used = operatorsUsed(algorithm(state.algorithm));
    state.operators.forEach((op, i) => {
      // An operator the wiring leaves out has no row.
      rows[i].hidden = !used.includes(i);
      const role = roleOf(state.algorithm, i);
      roles[i].textContent = role;
      // Its tag ringed in its pen, as its box is in the diagram.
      tags[i].dataset.role = role;
      COLUMNS.forEach((column, c) => {
        const slider = sliders[i][c];
        const shown = column.show(op[column.key]);
        slider.value = shown;
        // The filled part of the track; see .slider in base.css.
        const filled = (Number(shown) - column.min) / (column.max - column.min);
        slider.style.setProperty('--filled', `${(filled * 100).toFixed(2)}%`);
        slider.setAttribute('aria-valuetext', column.say(op[column.key]));
        const box = boxes[i][c];
        // Not while it is being typed in: that would fight the typing.
        if (document.activeElement !== box) box.value = shown;
      });
    });
  };
  const showPointed = (state: LabState) => {
    rows.forEach((row, i) => row.classList.toggle('is-pointed', state.hoverOp === i));
  };
  store.subscribe((state, previous) => {
    if (state.algorithm !== previous.algorithm || state.operators !== previous.operators) {
      show(state);
    }
    if (state.hoverOp !== previous.hoverOp) showPointed(state);
  });
  show(store.get());
  showPointed(store.get());
}
