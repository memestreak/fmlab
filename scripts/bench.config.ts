import { defineConfig } from 'vitest/config';

// The benchmarks' own run (`npm run bench:voices`): not part of `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/bench-*.ts'],
    disableConsoleIntercept: true,
  },
});
