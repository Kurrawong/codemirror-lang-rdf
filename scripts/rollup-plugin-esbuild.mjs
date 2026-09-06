import { transform } from 'esbuild';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Strip types with esbuild instead of running the TypeScript compiler inside
 * rollup.
 *
 * `@rollup/plugin-typescript` used to do both jobs — transpile and typecheck —
 * through TypeScript's JavaScript compiler API. TypeScript 7 is the native
 * port and ships no such API (`lib/` has a `tsc` binary and nothing to
 * `require`), so the plugin fails on load reading `ts.ScriptTarget.ES2015`.
 *
 * Splitting the two jobs is the fix, and is better anyway: `pnpm typecheck` is
 * an explicit gate that CI runs before the build rather than a side effect of
 * bundling, declarations come from `tsc --emitDeclarationOnly`, and the build
 * itself gets a good deal faster.
 *
 * This is a type-*stripping* transform: it never sees more than one file, so it
 * cannot check anything. That is safe here only because the sources set
 * `verbatimModuleSyntax`, which makes every type-only import say so.
 */
export function esbuildTypeScript({ target = 'es2020' } = {}) {
  return {
    name: 'esbuild-typescript',

    /*
     * TypeScript sources import each other without an extension (`./highlight`),
     * which rollup does not resolve on its own — the old plugin did it. Only
     * relative ids are considered, so `external` still decides everything else,
     * and `.grammar` imports fall through to the lezer plugin untouched.
     */
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.') || /\.[a-z]+$/i.test(source)) return null;
      const base = resolve(dirname(importer), source);
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`])
        if (existsSync(candidate)) return candidate;
      return null;
    },

    async transform(code, id) {
      if (!/\.tsx?$/.test(id)) return null;
      const result = await transform(code, {
        loader: id.endsWith('.tsx') ? 'tsx' : 'ts',
        target,
        sourcemap: true,
        sourcefile: id,
      });
      return { code: result.code, map: result.map };
    },
  };
}
