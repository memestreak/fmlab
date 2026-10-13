import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// The footer shows which commit a build came from. "dev" when git is not
// available (a tarball, a container without the .git directory).
const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  test: {
    // The tests so far are pure maths. Switch a test file to jsdom (and add
    // the package) when the first DOM test arrives.
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
