import { lezer } from '@lezer/generator/rollup';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  external: (id) => !/^[./]/.test(id),
  output: [
    { file: 'dist/index.js', format: 'es', sourcemap: true },
    { file: 'dist/index.cjs', format: 'cjs', sourcemap: true },
  ],
  plugins: [
    lezer(),
    typescript({
      tsconfig: './tsconfig.build.json',
      declaration: true,
      declarationDir: 'dist',
      sourceMap: true,
    }),
  ],
};
