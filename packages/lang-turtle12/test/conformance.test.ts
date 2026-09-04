import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parser } from '../dist/index.js';
import { runConformance, readExpectedFail } from '../../../test/harness';

const here = dirname(fileURLToPath(import.meta.url));
const corpus = join(here, 'corpus');
const expectedFailFile = join(corpus, 'expected-fail.json');

const groups = [
  { group: 'turtle12', top: 'TurtleDoc', size: 74 },
  { group: 'trig12', top: 'TrigDoc', size: 35 },
  { group: 'ntriples12', top: 'NTriplesDoc', size: 29 },
  { group: 'nquads12', top: 'NQuadsDoc', size: 27 },
] as const;

describe.each(groups)('W3C $group syntax suite', ({ group, top, size }) => {
  const results = runConformance(parser.configure({ top }), join(corpus, group));
  const expectedFail = readExpectedFail(expectedFailFile, group);

  /*
   * The suite's size is asserted outright. Without it, a vendoring mistake that
   * dropped half the corpus would read as a green build rather than a smaller
   * one, and the score below would be meaningless.
   */
  it(`covers the whole vendored group (${size} entries)`, () => {
    expect(results.length).toBe(size);
  });

  it('agrees with every entry it claims to decide', () => {
    const unexpected = results
      .filter((r) => !r.agreed && !expectedFail.has(r.entry.name))
      .map((r) => `${r.entry.expect} ${r.entry.name} (${r.entry.file})`);
    expect(unexpected).toEqual([]);
  });

  /*
   * The other half of the ratchet: an entry on the expected-fail list that has
   * started passing must come off the list. Otherwise the list quietly becomes
   * a place where working tests go to be ignored.
   */
  it('has no stale expected-fail entries', () => {
    const stale = results.filter((r) => r.agreed && expectedFail.has(r.entry.name)).map((r) => r.entry.name);
    expect(stale).toEqual([]);
  });

  it('lists no expected-fail entry that is not in the corpus', () => {
    const names = new Set(results.map((r) => r.entry.name));
    expect([...expectedFail].filter((n) => !names.has(n))).toEqual([]);
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
