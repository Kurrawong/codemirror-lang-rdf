import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parser } from '../dist/index.js';
import { readW3cExpectedFail, runW3cConformance, w3cCounts } from '../../../test/harness';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, 'corpus');

/*
 * The corpus is every query and update that a w3c/rdf-tests manifest
 * references, from the SPARQL 1.0, 1.1 and 1.2 suites. A negative syntax test
 * must produce an error node; every other file, including the queries and
 * updates of evaluation tests, must not. The 1.0 and 1.1 suites are here
 * because a 1.2 grammar that stopped parsing them would be a regression the
 * 1.2 suite alone cannot see.
 */
describe('W3C rdf-tests corpus', () => {
  const results = runW3cConformance({ sparql: parser.configure({ top: 'SparqlUnit' }) }, corpus);
  const expectedFail = readW3cExpectedFail(join(corpus, 'expected-fail.json'));

  it('vendors the expected entries per group', () => {
    expect(w3cCounts(results)).toMatchSnapshot();
  });

  it('agrees with every entry not on the expected-fail list', () => {
    const unexpected = results
      .filter((r) => !r.agreed && !expectedFail.has(r.entry.file))
      .map((r) => `${r.entry.expect} ${r.entry.file}`);
    expect(unexpected).toEqual([]);
  });

  it('has no stale expected-fail entries', () => {
    const stale = results.filter((r) => r.agreed && expectedFail.has(r.entry.file)).map((r) => r.entry.file);
    expect(stale).toEqual([]);
  });

  it('lists no expected-fail entry that is not in the corpus', () => {
    const files = new Set(results.map((r) => r.entry.file));
    expect([...expectedFail.keys()].filter((f) => !files.has(f))).toEqual([]);
  });

  it('expects no positive entry to fail', () => {
    const positive = results.filter((r) => r.entry.expect === 'positive' && expectedFail.has(r.entry.file));
    expect(positive.map((r) => r.entry.file)).toEqual([]);
  });
});
