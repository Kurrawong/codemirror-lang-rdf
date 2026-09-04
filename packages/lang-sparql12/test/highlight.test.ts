import { describe, expect, it } from 'vitest';
import { KEYWORDS, sparqlLanguage } from '../dist/index.js';
import { tagOf, tokenTags } from '../../../test/harness';

/**
 * The SPARQL half of the shared tag table in `docs/highlight-tags.md`.
 *
 * The cross-grammar agreement is asserted in `test/highlight-conventions.test.ts`
 * at the repository root; this file covers what only SPARQL has.
 */
const sparql = sparqlLanguage.parser;

describe('keywords', () => {
  /*
   * Every keyword, in three casings, rather than a chosen handful: the keyword
   * node names are generated from the grammar's terms, so the failure mode this
   * guards against is a keyword that has a term but no tag — invisible unless
   * something checks all of them.
   */
  it('tags every keyword the grammar knows', () => {
    const untagged: string[] = [];
    for (const kw of KEYWORDS) {
      // `a`, `true` and `false` are keywords in term position, not clause
      // position, so each keyword is exercised where it can legally appear:
      // a FILTER expression accepts function names, a pattern accepts the rest.
      const candidates = [
        `SELECT * { ${kw} }`,
        `${kw} * { ?s ?p ?o }`,
        `SELECT * { ?s ?p ${kw} }`,
        `SELECT * { FILTER(${kw}(?a)) }`,
        `${kw} <http://x>`,
        `${kw} DATA { <http://s> <http://p> 1 }`,
      ];
      const tagged = candidates.some((text) =>
        tokenTags(sparql, text).some((t) => t.text.toLowerCase() === kw && t.tag === 'keyword')
      );
      if (!tagged) untagged.push(kw);
    }
    expect(untagged).toEqual([]);
  });

  it.each(['SELECT', 'select', 'SeLeCt'])('tags %s as keyword whatever its casing', (kw) => {
    expect(tagOf(sparql, `${kw} * { ?s ?p ?o }`, kw)).toBe('keyword');
  });

  it('does not tag a keyword spelling used as a name', () => {
    expect(tagOf(sparql, 'SELECT ?select { ?s ?p ?o }', '?select')).toBe('variableName');
    expect(tagOf(sparql, 'SELECT * { ?s select:p ?o }', 'select:p')).toBe('namespace');
  });
});

describe('terms', () => {
  it('tags variables, both sigils', () => {
    expect(tagOf(sparql, 'ASK { ?s ?p ?o }', '?s')).toBe('variableName');
    expect(tagOf(sparql, 'ASK { $s ?p ?o }', '$s')).toBe('variableName');
  });

  it('tags IRIs and prefixed names', () => {
    expect(tagOf(sparql, 'ASK { <http://s> ex:p ?o }', '<http://s>')).toBe('url');
    expect(tagOf(sparql, 'ASK { <http://s> ex:p ?o }', 'ex:p')).toBe('namespace');
    expect(tagOf(sparql, 'PREFIX ex: <http://e/>', 'ex:')).toBe('namespace');
  });

  it('tags blank nodes as propertyName', () => {
    expect(tagOf(sparql, 'ASK { _:b ex:p ?o }', '_:b')).toBe('propertyName');
    expect(tagOf(sparql, 'ASK { ?s ex:p [] }', '[]')).toBe('propertyName');
  });

  it('tags literals by kind', () => {
    expect(tagOf(sparql, 'ASK { ?s ex:p "x" }', '"x"')).toBe('string');
    expect(tagOf(sparql, 'ASK { ?s ex:p 42 }', '42')).toBe('number');
    expect(tagOf(sparql, 'ASK { ?s ex:p -42 }', '-42')).toBe('number');
    expect(tagOf(sparql, 'ASK { ?s ex:p +4.2 }', '+4.2')).toBe('number');
    expect(tagOf(sparql, 'ASK { ?s ex:p 4.2e1 }', '4.2e1')).toBe('number');
    expect(tagOf(sparql, 'ASK { ?s ex:p true }', 'true')).toBe('keyword');
  });

  it('tags a language tag as annotation and a datatype as typeName', () => {
    expect(tagOf(sparql, 'ASK { ?s ex:p "x"@en--rtl }', '@en--rtl')).toBe('annotation');
    expect(tagOf(sparql, 'ASK { ?s ex:p "x"^^xsd:string }', 'xsd:string')).toBe('typeName');
    expect(tagOf(sparql, 'ASK { ?s ex:p "x"^^xsd:string }', '^^')).toBe('typeName');
  });

  it('tags a VERSION specifier as a string', () => {
    expect(tagOf(sparql, 'VERSION "1.2"', '"1.2"')).toBe('string');
  });
});

describe('brackets and operators', () => {
  it('tags the RDF 1.2 delimiters as brace', () => {
    const tt = tokenTags(sparql, 'ASK { ?s ?p <<( ?a ?b ?c )>> }');
    expect(tt.find((t) => t.text === '<<(')?.tag).toBe('brace');
    expect(tt.find((t) => t.text === ')>>')?.tag).toBe('brace');

    const rt = tokenTags(sparql, 'ASK { << ?a ?b ?c >> ?p ?o }');
    expect(rt.find((t) => t.text === '<<')?.tag).toBe('brace');
    expect(rt.find((t) => t.text === '>>')?.tag).toBe('brace');

    const an = tokenTags(sparql, 'ASK { ?s ex:p ?o {| ex:q ?z |} }');
    expect(an.find((t) => t.text === '{|')?.tag).toBe('brace');
    expect(an.find((t) => t.text === '|}')?.tag).toBe('brace');
  });

  it('tags a group graph pattern as brace', () => {
    const tt = tokenTags(sparql, 'ASK { ?s ?p ?o }');
    expect(tt.find((t) => t.text === '{')?.tag).toBe('brace');
    expect(tt.find((t) => t.text === '}')?.tag).toBe('brace');
  });

  it('tags parens and square brackets apart', () => {
    expect(tokenTags(sparql, 'ASK { ?s ex:p ( ex:a ) }').find((t) => t.text === '(')?.tag).toBe('paren');
    expect(tokenTags(sparql, 'ASK { [ ex:p ?o ] ex:q ?z }').find((t) => t.text === '[')?.tag).toBe(
      'squareBracket'
    );
  });

  it.each([
    ['ASK { FILTER(?a && ?b) }', '&&'],
    ['ASK { FILTER(?a || ?b) }', '||'],
    ['ASK { FILTER(?a = ?b) }', '='],
    ['ASK { FILTER(?a != ?b) }', '!='],
    ['ASK { FILTER(?a <= ?b) }', '<='],
    ['ASK { FILTER(?a >= ?b) }', '>='],
    ['ASK { FILTER(?a + ?b > 1) }', '+'],
    ['ASK { FILTER(?a * ?b > 1) }', '*'],
    ['ASK { FILTER(!?a) }', '!'],
    ['ASK { << ?a ?b ?c ~?r >> ?p ?o }', '~'],
    ['ASK { ?s ^ex:p ?o }', '^'],
    ['ASK { ?s ex:p|ex:q ?o }', '|'],
  ])('tags the operator in %j: %s', (text, token) => {
    expect(tagOf(sparql, text, token)).toBe('operator');
  });

  it('tags separators and the statement terminator apart', () => {
    const tt = tokenTags(sparql, 'ASK { ?s ex:p ex:o , ex:o2 ; ex:p2 ex:o3 . }');
    expect(tt.find((t) => t.text === ',')?.tag).toBe('separator');
    expect(tt.find((t) => t.text === ';')?.tag).toBe('separator');
    expect(tt.find((t) => t.text === '.')?.tag).toBe('punctuation');
  });
});

describe('comments', () => {
  it('tags a comment as comment', () => {
    expect(tagOf(sparql, '# hi\nASK { ?s ?p ?o }', '# hi')).toBe('comment');
  });
});
