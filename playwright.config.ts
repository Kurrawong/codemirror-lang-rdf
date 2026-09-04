import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/*
 * Some sandboxes ship a Chromium that Playwright did not download and cannot
 * re-download, at a revision its own manifest does not name. `PW_CHROMIUM`
 * points at such a build; where it is absent (CI, a normal checkout) the
 * browser Playwright manages is used, which is the default and the one the
 * pinned version was tested against.
 */
const preinstalled = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium';
const executablePath = existsSync(preinstalled) ? preinstalled : undefined;

/**
 * The fixture is a static page loaded over `file://`: there is no server to
 * start, no framework to boot, and nothing between the test and the editor but
 * the bundle an application would ship.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    // The directory, with its trailing slash: a `file://` baseURL resolves a
    // relative path by URL rules, so `goto('/')` would ask for the filesystem
    // root rather than the fixture.
    baseURL: `${pathToFileURL(resolve('e2e/.build')).href}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } },
    },
  ],
});
