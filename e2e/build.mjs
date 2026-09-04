/**
 * Bundle the e2e fixture.
 *
 * The three packages are consumed the way an application consumes them — by
 * package name, through the workspace link, from their built `dist` — so the
 * end-to-end tests exercise the published entry points and the `exports` map,
 * not the source tree.
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(here, 'fixture', 'app.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  outfile: join(here, '.build', 'app.js'),
  logLevel: 'info',
});

// The HTML sits next to the bundle so `file://` resolves `./app.js`.
const { copyFile } = await import('node:fs/promises');
await copyFile(join(here, 'fixture', 'index.html'), join(here, '.build', 'index.html'));
