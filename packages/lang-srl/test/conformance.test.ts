import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parser } from '../dist/index.js';
import { parsesCleanly, readExpectedFail, runConformance } from '../../../test/harness';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, 'corpus');
const group = 'srl-syntax';

describe('W3C SPARQL-RL syntax suite', () => {
  const results = runConformance(parser, join(corpus, group));
  const expectedFail = readExpectedFail(join(corpus, 'expected-fail.json'), group);

  it('covers the whole vendored group (139 entries)', () => {
    expect(results.length).toBe(139);
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

  it('decides every positive entry', () => {
    const failing = results.filter((r) => r.entry.expect === 'positive' && !r.agreed);
    expect(failing.map((r) => r.entry.name)).toEqual([]);
  });
});

describe('the removed rule forms', () => {
  /*
   * `FOR ?var IN <shape>` and the `IF … THEN` rule form were removed from the
   * SRL grammar upstream on 2026-08-24 (w3c/data-shapes 58fdfc6 and cfbcd3c),
   * and the five tests that covered them went with them. This grammar follows
   * the current spec, so both are errors — asserted rather than assumed,
   * because an earlier draft's syntax silently parsing is exactly the kind of
   * thing a reader would not notice.
   */
  it('does not accept the IF … THEN form', () => {
    expect(parsesCleanly(parser, 'IF { ?s ?p ?o } THEN { ?s ?p ?o }')).toBe(false);
  });

  it('does not accept a FOR clause', () => {
    expect(parsesCleanly(parser, 'RULE FOR ?x IN <http://s> { } WHERE { }')).toBe(false);
  });
});
