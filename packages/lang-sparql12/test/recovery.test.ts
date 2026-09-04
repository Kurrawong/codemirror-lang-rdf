import { describe, expect, it } from 'vitest';
import { parser } from '../dist/index.js';
import { errorRanges, parsesCleanly } from '../../../test/harness';

/**
 * Error recovery is a tested property, not a hope.
 *
 * A document is mid-edit most of the time it is being read, so a typo must be
 * contained: in SPARQL the boundary that has to hold is `}`, because that is
 * where a reader's structure is. If one bad triple uncoloured the rest of the
 * query, the grammar would be worse than no grammar.
 */
const sparql = parser.configure({ top: 'SparqlUnit' });

function namesAfter(text: string, from: number): string[] {
  const names: string[] = [];
  sparql.parse(text).iterate({
    from,
    to: text.length,
    enter: (n) => {
      names.push(n.name);
    },
  });
  return names;
}

describe('recovery at a closing brace', () => {
  it('contains a broken group to itself', () => {
    const text = 'SELECT * {\n  ?s ?p\n}\nGROUP BY ?s\n';
    expect(parsesCleanly(sparql, text)).toBe(false);
    expect(namesAfter(text, text.indexOf('GROUP'))).toContain('GroupClause');
  });

  it('keeps the second pattern intact after a broken first', () => {
    const text = 'SELECT * { { ?s ?p } UNION { ?a ?b ?c } }\n';
    expect(parsesCleanly(sparql, text)).toBe(false);
    expect(namesAfter(text, text.indexOf('?a'))).toContain('TriplesSameSubjectPath');
  });

  it('recovers into the next operation of an update sequence', () => {
    const text = 'INSERT DATA { ?s } ;\nDROP ALL\n';
    expect(parsesCleanly(sparql, text)).toBe(false);
    expect(namesAfter(text, text.indexOf('DROP'))).toContain('Drop');
  });

  it('survives an unclosed group', () => {
    const text = 'SELECT * { ?s ?p ?o\n';
    expect(parsesCleanly(sparql, text)).toBe(false);
    expect(namesAfter(text, 0)).toContain('GroupGraphPattern');
  });

  it('survives an unknown clause word', () => {
    const text = 'SELECT * { ?s ?p ?o } NONSENSE BY ?s\n';
    expect(parsesCleanly(sparql, text)).toBe(false);
    expect(namesAfter(text, 0)).toContain('SelectQuery');
  });

  it('reports a bounded number of error regions for one typo', () => {
    const text = 'SELECT * {\n  ?s ?p\n  ?a ?b ?c .\n  ?d ?e ?f .\n}\n';
    expect(errorRanges(sparql, text).length).toBeLessThanOrEqual(2);
  });
});

describe('an incomplete document still parses into something', () => {
  it.each([
    'SELECT',
    'SELECT *',
    'SELECT * {',
    'SELECT * { ?s',
    'PREFIX ',
    'CONSTRUCT {',
    'INSERT DATA',
    'DELETE',
  ])('parses %j without throwing', (text) => {
    expect(() => sparql.parse(text)).not.toThrow();
    // And leaves the keyword it does have in the tree, so it still colours.
    expect(namesAfter(text, 0).length).toBeGreaterThan(1);
  });
});

describe('SRL recovers at the same boundaries', () => {
  const srl = parser.configure({ top: 'SrlUnit' });

  function srlNamesAfter(text: string, from: number): string[] {
    const names: string[] = [];
    srl.parse(text).iterate({
      from,
      to: text.length,
      enter: (n) => {
        names.push(n.name);
      },
    });
    return names;
  }

  it('contains a broken rule to itself', () => {
    const text = 'RULE { ?s } WHERE { ?s ?p ?o }\nRULE { ?a ?b ?c } WHERE { ?a ?b ?c }\n';
    expect(parsesCleanly(srl, text)).toBe(false);
    expect(srlNamesAfter(text, text.lastIndexOf('RULE'))).toContain('Rule');
  });

  it('keeps a DATA block after a broken rule', () => {
    const text = 'RULE { ?s } WHERE { }\nDATA { <http://s> <http://p> 1 }\n';
    expect(srlNamesAfter(text, text.indexOf('DATA'))).toContain('SrlDataBlock');
  });
});
