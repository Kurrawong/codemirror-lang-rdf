import { lezer } from '@lezer/generator/rollup';
import { esbuildTypeScript } from '../../scripts/rollup-plugin-esbuild.mjs';

export default {
  input: 'src/index.ts',
  external: (id) => !/^[./]/.test(id),
  output: [
    { file: 'dist/index.js', format: 'es', sourcemap: true },
    { file: 'dist/index.cjs', format: 'cjs', sourcemap: true },
  ],
  // Declarations are emitted separately, by `tsc --emitDeclarationOnly` in the
  // package's build script. See scripts/rollup-plugin-esbuild.mjs.
  plugins: [lezer(), esbuildTypeScript()],
};
