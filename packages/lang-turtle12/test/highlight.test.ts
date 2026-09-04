import { describe, expect, it } from 'vitest';
import { turtleLanguage, trigLanguage, nquadsLanguage } from '../dist/index.js';
import { tagOf, tokenTags } from '../../../test/harness';

/**
 * The Turtle half of the shared tag table in `docs/highlight-tags.md`.
 *
 * The cross-grammar agreement is asserted in `test/highlight-conventions.test.ts`
 * at the repository root; this file covers the constructs only Turtle has.
 */
const turtle = turtleLanguage.parser;
const trig = trigLanguage.parser;
const nquads = nquadsLanguage.parser;

describe('terms', () => {
  it('tags an IRI as url and a prefixed name as namespace', () => {
    expect(tagOf(turtle, 'ex:s ex:p <http://o> .', '<http://o>')).toBe('url');
    expect(tagOf(turtle, 'ex:s ex:p <http://o> .', 'ex:s')).toBe('namespace');
  });

  it('tags a declaration namespace as namespace', () => {
    expect(tagOf(turtle, '@prefix ex: <http://e/> .', 'ex:')).toBe('namespace');
  });

  it('tags blank nodes as propertyName', () => {
    expect(tagOf(turtle, 'ex:s ex:p _:b .', '_:b')).toBe('propertyName');
    expect(tagOf(turtle, 'ex:s ex:p [] .', '[]')).toBe('propertyName');
  });

  it('tags literals by kind', () => {
    expect(tagOf(turtle, 'ex:s ex:p "x" .', '"x"')).toBe('string');
    expect(tagOf(turtle, 'ex:s ex:p 42 .', '42')).toBe('number');
    expect(tagOf(turtle, 'ex:s ex:p 4.2 .', '4.2')).toBe('number');
    expect(tagOf(turtle, 'ex:s ex:p 4.2e1 .', '4.2e1')).toBe('number');
    expect(tagOf(turtle, 'ex:s ex:p true .', 'true')).toBe('bool');
    expect(tagOf(turtle, 'ex:s ex:p false .', 'false')).toBe('bool');
  });

  it('tags a language tag as annotation and a datatype as typeName', () => {
    expect(tagOf(turtle, 'ex:s ex:p "x"@en--ltr .', '@en--ltr')).toBe('annotation');
    expect(tagOf(nquads, '<http://s> <http://p> "x"@en .', '@en')).toBe('annotation');
    expect(tagOf(turtle, 'ex:s ex:p "x"^^xsd:string .', 'xsd:string')).toBe('typeName');
    expect(tagOf(turtle, 'ex:s ex:p "x"^^<http://t> .', '<http://t>')).toBe('typeName');
    expect(tagOf(turtle, 'ex:s ex:p "x"^^<http://t> .', '^^')).toBe('typeName');
  });
});

describe('keywords', () => {
  it.each([
    ['@prefix ex: <http://e/> .', '@prefix'],
    ['@base <http://e/> .', '@base'],
    ['PREFIX ex: <http://e/>', 'PREFIX'],
    ['BASE <http://e/>', 'BASE'],
    ['VERSION "1.2"', 'VERSION'],
    ['ex:s a ex:o .', 'a'],
  ])('tags %j: %s as keyword', (text, token) => {
    expect(tagOf(turtle, text, token)).toBe('keyword');
  });

  it('tags GRAPH as keyword, in any casing', () => {
    for (const kw of ['GRAPH', 'graph', 'GrApH'])
      expect(tagOf(trig, `${kw} ex:g { ex:s ex:p ex:o }`, kw)).toBe('keyword');
  });
});

describe('brackets, operators and separators', () => {
  it('tags the RDF 1.2 delimiters as brace', () => {
    const tags = tokenTags(turtle, 'ex:s ex:p <<( ex:a ex:b ex:c )>> .');
    expect(tags.find((t) => t.text === '<<(')?.tag).toBe('brace');
    expect(tags.find((t) => t.text === ')>>')?.tag).toBe('brace');

    const reified = tokenTags(turtle, '<< ex:a ex:b ex:c >> ex:p ex:o .');
    expect(reified.find((t) => t.text === '<<')?.tag).toBe('brace');
    expect(reified.find((t) => t.text === '>>')?.tag).toBe('brace');

    const annotated = tokenTags(turtle, 'ex:s ex:p ex:o {| ex:q ex:r |} .');
    expect(annotated.find((t) => t.text === '{|')?.tag).toBe('brace');
    expect(annotated.find((t) => t.text === '|}')?.tag).toBe('brace');
  });

  it('tags a TriG graph block as brace', () => {
    const tags = tokenTags(trig, 'ex:g { ex:s ex:p ex:o }');
    expect(tags.find((t) => t.text === '{')?.tag).toBe('brace');
    expect(tags.find((t) => t.text === '}')?.tag).toBe('brace');
  });

  it('tags the reifier marker as an operator', () => {
    expect(tagOf(turtle, 'ex:s ex:p ex:o ~ex:r {| ex:q ex:r |} .', '~')).toBe('operator');
  });

  it('tags separators and the statement terminator apart', () => {
    const tags = tokenTags(turtle, 'ex:s ex:p ex:o , ex:o2 ; ex:p2 ex:o3 .');
    expect(tags.find((t) => t.text === ',')?.tag).toBe('separator');
    expect(tags.find((t) => t.text === ';')?.tag).toBe('separator');
    expect(tags.find((t) => t.text === '.')?.tag).toBe('punctuation');
  });

  it('tags square brackets and parens apart from braces', () => {
    const tags = tokenTags(turtle, 'ex:s ex:p [ ex:q ( ex:a ) ] .');
    expect(tags.find((t) => t.text === '[')?.tag).toBe('squareBracket');
    expect(tags.find((t) => t.text === ']')?.tag).toBe('squareBracket');
    expect(tags.find((t) => t.text === '(')?.tag).toBe('paren');
    expect(tags.find((t) => t.text === ')')?.tag).toBe('paren');
  });
});

describe('comments', () => {
  it('tags a comment as comment', () => {
    expect(tagOf(turtle, '# hello\nex:s ex:p ex:o .', '# hello')).toBe('comment');
  });
});
