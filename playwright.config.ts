import { defineConfig, devices } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

/*
 * `PW_CHROMIUM` selects a browser explicitly. Some local environments retain
 * a Chromium revision that differs from the Playwright package's expected
 * revision, so look for a usable cached Chromium before falling back to
 * Playwright's managed browser. CI installs the expected browser and does not
 * need this fallback.
 */
function cachedChromium(): string | undefined {
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(cache)) return undefined;

  const candidates = readdirSync(cache)
    .filter((entry) => entry.startsWith('chromium-') && !entry.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()
    .map((entry) => join(cache, entry, 'chrome-linux64', 'chrome'));

  return candidates.find(existsSync);
}

const candidates = [process.env.PW_CHROMIUM, '/opt/pw-browsers/chromium', cachedChromium()];
const executablePath = candidates.find((candidate): candidate is string => !!candidate && existsSync(candidate));

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
