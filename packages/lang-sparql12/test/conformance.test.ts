import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parser } from '../dist/index.js';
import { readExpectedFail, runConformance } from '../../../test/harness';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, 'corpus');
const expectedFailFile = join(corpus, 'expected-fail.json');
const sparql = parser.configure({ top: 'SparqlUnit' });

/*
 * The SPARQL 1.1 syntax suites are here as well as the 1.2 ones: a 1.2 grammar
 * that stopped parsing 1.1 would be a regression the 1.2 suite alone cannot
 * see, and 1.1 is what almost every query in the wild still is.
 */
const groups = [
  { group: 'sparql11-query', size: 94 },
  { group: 'sparql11-update', size: 54 },
  { group: 'sparql11-fed', size: 3 },
  { group: 'sparql12-syntax', size: 6 },
  { group: 'sparql12-triple-terms-positive', size: 95 },
  { group: 'sparql12-triple-terms-negative', size: 63 },
  { group: 'sparql12-version', size: 9 },
  { group: 'sparql12-lang-basedir', size: 1 },
  { group: 'sparql12-codepoint-escapes', size: 9 },
] as const;

describe.each(groups)('W3C $group syntax suite', ({ group, size }) => {
  const results = runConformance(sparql, join(corpus, group));
  const expectedFail = readExpectedFail(expectedFailFile, group);

  it(`covers the whole vendored group (${size} entries)`, () => {
    expect(results.length).toBe(size);
  });

  it('agrees with every entry it claims to decide', () => {
    const unexpected = results
      .filter((r) => !r.agreed && !expectedFail.has(r.entry.name))
      .map((r) => `${r.entry.expect} ${r.entry.name} (${r.entry.file})`);
    expect(unexpected).toEqual([]);
  });

  it('has no stale expected-fail entries', () => {
    const stale = results.filter((r) => r.agreed && expectedFail.has(r.entry.name)).map((r) => r.entry.name);
    expect(stale).toEqual([]);
  });

  it('lists no expected-fail entry that is not in the corpus', () => {
    const names = new Set(results.map((r) => r.entry.name));
    expect([...expectedFail].filter((n) => !names.has(n))).toEqual([]);
  });
});

describe('every 1.2 positive triple-term test parses', () => {
  /*
   * Called out separately from the loop above because it is the point of the
   * package: these 95 files are the reason a 1.1 grammar was not enough.
   */
  it('has no expected-fail entries at all', () => {
    expect([...readExpectedFail(expectedFailFile, 'sparql12-triple-terms-positive')]).toEqual([]);
  });
});
