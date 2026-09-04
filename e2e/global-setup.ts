import { execFileSync } from 'node:child_process';

/**
 * Build the packages and the fixture before the browser starts.
 *
 * Doing it here rather than in a `pretest` script means `playwright test` on
 * its own is always testing the current source, which is what someone
 * debugging a failure will run.
 */
export default function globalSetup() {
  execFileSync('pnpm', ['-r', '--filter', './packages/*', 'run', 'build'], { stdio: 'inherit' });
  execFileSync('node', ['e2e/build.mjs'], { stdio: 'inherit' });
}
