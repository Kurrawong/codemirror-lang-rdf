/**
 * Build (or serve) the demo.
 *
 * `node demo/build.mjs --serve` starts esbuild's own dev server with a watcher,
 * so editing a grammar and re-running `pnpm build` is enough to see the change
 * on reload. `node demo/build.mjs` produces a static bundle in `demo/dist`,
 * which is deployable as-is — it is a `file://`-safe page with no server
 * requirement of its own.
 *
 * The three packages are imported by name through the workspace link, so the
 * demo consumes exactly what an application would: the built `dist` and the
 * `exports` map, not the source tree.
 */
import { context } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outdir = join(here, 'dist');
const serve = process.argv.includes('--serve');

await mkdir(outdir, { recursive: true });
await copyFile(join(here, 'index.html'), join(outdir, 'index.html'));

const ctx = await context({
  entryPoints: [join(here, 'src', 'main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  minify: !serve,
  outfile: join(outdir, 'main.js'),
  logLevel: 'info',
});

if (!serve) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
  const { hosts, port } = await ctx.serve({ servedir: outdir, host: '127.0.0.1' });
  console.log(`\n  demo running at http://${hosts[0]}:${port}/\n  press ctrl-c to stop\n`);
}
