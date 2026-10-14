import { algorithm, algorithmsByCarriers, operatorsUsed } from '../dsp/algorithms';
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

  const inputs: HTMLInputElement[][] = [];
  const roles: HTMLElement[] = [];
  /** Each operator's cells, to blank out when its wiring leaves it out. */
  const cells: HTMLElement[][] = [];
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
    cells.push([name, role]);
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
        cells[op].push(cell);
        return input;
      }),
    );
  }
  table.append(...rows);
  const secondHeads = [
    ...(table.closest('table')?.querySelectorAll<HTMLElement>('thead th') ?? []),
  ].slice(5);

  const show = (state: LabState) => {
    select.value = String(state.algorithm);
    const used = operatorsUsed(algorithm(state.algorithm));
    // An operator left out is blanked, keeping the columns where they
    // are; a row with neither of its two is taken out.
    rows.forEach((row, r) => {
      row.hidden = !used.includes(r) && !used.includes(r + 3);
    });
    // And the right-hand half's headings, when it has no operator.
    const second = used.some(op => op >= 3);
    secondHeads.forEach(head => head.classList.toggle('op-off', !second));
    state.operators.forEach((op, i) => {
      for (const cell of cells[i]) cell.classList.toggle('op-off', !used.includes(i));
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
