import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (pkg: string) => readFileSync(join(root, 'packages', pkg, 'src', 'layout.ts'), 'utf8');

describe('the formatter layout engine', () => {
  /*
   * lang-turtle12 and lang-sparql12 do not depend on each other, so each has a
   * copy of the engine. Edit one and copy it over the other.
   */
  it('is the same file in lang-turtle12 and lang-sparql12', () => {
    expect(read('lang-sparql12')).toBe(read('lang-turtle12'));
  });
});
