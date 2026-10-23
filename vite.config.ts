import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// The footer shows which commit a build came from, linked to it on GitHub
// by its full hash. "dev" when git is not available (a tarball, a
// container without the .git directory).
const git = (args: string) => {
  try {
    return execSync(`git ${args}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
};
const commitHash = git('rev-parse --short HEAD');
const commitFull = git('rev-parse HEAD');

export default defineConfig({
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_FULL__: JSON.stringify(commitFull),
  },
  test: {
    // The tests so far are pure maths. Switch a test file to jsdom (and add
    // the package) when the first DOM test arrives.
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
