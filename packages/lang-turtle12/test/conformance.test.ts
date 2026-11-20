import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parser } from '../dist/index.js';
import { readW3cExpectedFail, runW3cConformance, w3cCounts } from '../../../test/harness';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, 'corpus');

const parsers = {
  turtle: parser.configure({ top: 'TurtleDoc' }),
  trig: parser.configure({ top: 'TrigDoc' }),
  ntriples: parser.configure({ top: 'NTriplesDoc' }),
  nquads: parser.configure({ top: 'NQuadsDoc' }),
};

/*
 * The corpus is every Turtle, TriG, N-Triples and N-Quads file that a
 * w3c/rdf-tests manifest references, in both the RDF and the SPARQL suites. A
 * negative syntax test must produce an error node; every other file, including
 * evaluation-test inputs and expected results, must not.
 */
describe('W3C rdf-tests corpus', () => {
  const results = runW3cConformance(parsers, corpus);
  const expectedFail = readW3cExpectedFail(join(corpus, 'expected-fail.json'));

  /*
   * The counts are a snapshot, so a vendoring change that drops or adds files
   * shows up in review as a changed snapshot instead of a quietly smaller or
   * larger corpus.
   */
  it('vendors the expected entries per group', () => {
    expect(w3cCounts(results)).toMatchSnapshot();
  });

  it('agrees with every entry not on the expected-fail list', () => {
    const unexpected = results
      .filter((r) => !r.agreed && !expectedFail.has(r.entry.file))
      .map((r) => `${r.entry.expect} ${r.entry.lang} ${r.entry.file}`);
    expect(unexpected).toEqual([]);
  });

  /*
   * The other half of the ratchet: an entry on the expected-fail list that has
   * started passing must come off the list. Otherwise the list quietly becomes
   * a place where working tests go to be ignored.
   */
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

describe('cross-dialect strictness', () => {
  const ntriples = parser.configure({ top: 'NTriplesDoc' });
  const turtle = parser.configure({ top: 'TurtleDoc' });

  /*
   * The reason N-Triples gets its own entry point rather than being coloured by
   * the Turtle grammar: these documents are Turtle, and are not N-Triples.
   */
  const turtleOnly = [
    '@prefix ex: <http://e/> .\nex:s ex:p ex:o .',
    '<http://s> <http://p> <http://o> ; <http://p2> <http://o2> .',
    '<http://s> <http://p> [ <http://q> <http://r> ] .',
    '<http://s> <http://p> ( <http://a> ) .',
    '<http://s> <http://p> << <http://a> <http://b> <http://c> >> .',
  ];

  it.each(turtleOnly)('N-Triples rejects Turtle-only syntax: %s', (text) => {
    expect(runOne(ntriples, text)).toBe(false);
    expect(runOne(turtle, text)).toBe(true);
  });
});

function runOne(p: ReturnType<typeof parser.configure>, text: string): boolean {
  let clean = true;
  p.parse(text).iterate({
    enter: (n) => {
      if (n.type.isError) clean = false;
    },
  });
  return clean;
}
