import { algorithm, ALGORITHM_COUNT } from '../dsp/algorithms';
import type { Operator } from '../dsp/operators';
import {
  clamp,
  type LabState,
  type LabStore,
  OP_DECAY,
  OP_LEVEL,
  OP_RATIO,
} from '../model/lab';

/** One column of the operator table: which number, and its input's range. */
interface Column {
  key: keyof Operator;
  label: string;
  min: number;
  max: number;
  step: number;
  /** The input shows the operator's value through this. */
  show: (value: number) => string;
  /** And reads the operator's value back from what is typed. */
  read: (typed: number) => number;
}

const COLUMNS: Column[] = [
  {
    key: 'ratio',
    label: 'Ratio',
    min: OP_RATIO.min,
    max: OP_RATIO.max,
    step: 0.01,
    show: value => String(Number(value.toFixed(2))),
    read: typed => clamp(typed, OP_RATIO),
  },
  {
    // Shown as a percentage; held as 0 to 1.
    key: 'level',
    label: 'Level %',
    min: OP_LEVEL.min * 100,
    max: OP_LEVEL.max * 100,
    step: 1,
    show: value => String(Math.round(value * 100)),
    read: typed => clamp(typed / 100, OP_LEVEL),
  },
  {
    key: 'decay',
    label: 'Decay s',
    min: OP_DECAY.min,
    max: OP_DECAY.max,
    step: 0.1,
    show: value => String(Number(value.toFixed(2))),
    read: typed => clamp(typed, OP_DECAY),
  },
];

/** "carrier" or "modulator": what an operator is in an algorithm. */
export function roleOf(algorithmNumber: number, op: number): 'carrier' | 'modulator' {
  return algorithm(algorithmNumber).carriers.includes(op) ? 'carrier' : 'modulator';
}

/**
 * The operator controls of chapter 8: the algorithm, chosen from a list of
 * all 32, and a table of the six operators, a row each with its role in
 * the algorithm and three number boxes (ratio, level, decay). Number boxes
 * rather than sliders: eighteen sliders would not leave the figures room.
 * They take arrow keys, and typing.
 */
export function mountOperators(store: LabStore): void {
  const select = document.querySelector<HTMLSelectElement>('#algorithm');
  const table = document.querySelector<HTMLTableSectionElement>('#operators tbody');
  if (!select || !table) return;

  for (let number = 1; number <= ALGORITHM_COUNT; number++) {
    const option = document.createElement('option');
    option.value = String(number);
    option.textContent = String(number);
    select.append(option);
  }
  select.addEventListener('change', () => {
    store.set({ algorithm: Number(select.value) });
  });

  const inputs: HTMLInputElement[][] = [];
  const roles: HTMLElement[] = [];
  // Three rows, each with two operators: OP1 and OP4, OP2 and OP5, ...
  const rows = [0, 1, 2].map(() => document.createElement('tr'));
  for (let op = 0; op < 6; op++) {
    const row = rows[op % 3];
    const name = document.createElement('th');
    if (op >= 3) name.className = 'op-second';
    name.scope = 'row';
    name.textContent = `OP${op + 1}`;
    const role = document.createElement('td');
    role.className = 'op-role';
    row.append(name, role);
    roles.push(role);
    inputs.push(
      COLUMNS.map(column => {
        const cell = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'op-input num';
        input.min = String(column.min);
        input.max = String(column.max);
        input.step = String(column.step);
        input.setAttribute('aria-label', `OP${op + 1} ${column.label.replace(/ .*/, '').toLowerCase()}`);
        input.addEventListener('input', () => {
          const typed = input.valueAsNumber;
          if (!Number.isFinite(typed)) return;
          const operators = store.get().operators.map((o, i) =>
            i === op ? { ...o, [column.key]: column.read(typed) } : o,
          );
          store.set({ operators });
        });
        // Put a number typed out of range back into it, once left.
        input.addEventListener('change', () => show(store.get()));
        cell.append(input);
        row.append(cell);
        return input;
      }),
    );
  }
  table.append(...rows);

  const show = (state: LabState) => {
    select.value = String(state.algorithm);
    state.operators.forEach((op, i) => {
      roles[i].textContent = roleOf(state.algorithm, i);
      COLUMNS.forEach((column, c) => {
        const input = inputs[i][c];
        // Not while it is being typed in: that would fight the typing.
        if (document.activeElement === input) return;
        input.value = column.show(op[column.key]);
      });
    });
  };
  store.subscribe((state, previous) => {
    if (state.algorithm !== previous.algorithm || state.operators !== previous.operators) {
      show(state);
    }
  });
  show(store.get());
}
