import { describe, expect, it } from 'vitest';
import { language } from '@codemirror/language';
import { parseErrors, parser, sparql, sparqlLanguage, sparqlLateralLanguage } from '../dist/index.js';
import { nodeNames, parsesCleanly, tagOf, textOf } from '../../../test/harness';
import { completionLabels, completionsAt, foldedText, stateFor } from '../../../test/editor';

/**
 * `A LATERAL { B }` (SEP-0006) is opt-in: the grammar's `lateral` dialect,
 * enabled by `sparql({ lateral: true })`. With it off, nothing about how the
 * word `lateral` parses may change.
 */
const plain = sparqlLanguage.parser;
const lateral = sparqlLateralLanguage.parser;

const LATERAL_QUERIES = [
  'SELECT * WHERE { ?s ?p ?o LATERAL { SELECT ?x WHERE { ?s ?q ?x } LIMIT 1 } }',
  'SELECT * WHERE { ?s ?p ?o lateral # one search per row\n { ?s ?q ?x } }',
  'SELECT * WHERE { LATERAL { ?s ?p ?o } OPTIONAL { ?s ?q ?r } }',
  'SELECT * WHERE { ?s ?p ?o . LATERAL { ?s ?q ?r } . ?r ?x ?y }',
  'SELECT * WHERE { ?s ?p ?o LATERAL { ?s ?q ?r LATERAL { ?r ?x ?y } } }',
  'INSERT { ?s ?p 1 } WHERE { ?s ?p ?o LATERAL { ?s ?q ?r } }',
];

/** Uses of the word that are not the keyword, and must parse either way. */
const NOT_THE_KEYWORD = [
  'PREFIX lateral: <http://example.org/> SELECT * WHERE { ?s lateral:p ?o }',
  'SELECT ?lateral WHERE { ?lateral ?p ?o }',
  'SELECT * WHERE { ?s <http://example.org/lateral> "lateral" }',
];

describe('LATERAL with the dialect on', () => {
  it.each(LATERAL_QUERIES)('parses %s', (text) => {
    expect(parsesCleanly(lateral, text)).toBe(true);
    expect(nodeNames(lateral, text).has('LateralGraphPattern')).toBe(true);
  });

  it.each(NOT_THE_KEYWORD)('still reads %s as before', (text) => {
    expect(parsesCleanly(lateral, text)).toBe(true);
    expect(nodeNames(lateral, text).has('LateralGraphPattern')).toBe(false);
  });

  it('keeps the group as the LATERAL node’s body', () => {
    expect(textOf(lateral, 'SELECT * { ?s ?p ?o LATERAL { ?s ?q ?r } }', 'LateralGraphPattern')).toBe(
      'LATERAL { ?s ?q ?r }'
    );
  });

  it('rejects LATERAL without a group after it', () => {
    expect(parsesCleanly(lateral, 'SELECT * WHERE { ?s ?p ?o LATERAL ?x }')).toBe(false);
  });

  it('rejects LATERAL outside a group graph pattern', () => {
    expect(parsesCleanly(lateral, 'SELECT * LATERAL { ?s ?p ?o }')).toBe(false);
  });

  it.each(['LATERAL', 'lateral', 'LaTeRaL'])('tags %s as keyword', (kw) => {
    expect(tagOf(lateral, `SELECT * { ?s ?p ?o ${kw} { ?s ?q ?r } }`, kw)).toBe('keyword');
  });
});

describe('LATERAL with the dialect off', () => {
  it.each(LATERAL_QUERIES)('is an error in %s', (text) => {
    expect(parsesCleanly(plain, text)).toBe(false);
    expect(parsesCleanly(parser.configure({ top: 'SparqlUnit' }), text)).toBe(false);
  });

  it.each(NOT_THE_KEYWORD)('parses %s', (text) => {
    expect(parsesCleanly(plain, text)).toBe(true);
  });

  it('is not tagged as a keyword', () => {
    expect(tagOf(plain, 'SELECT * { ?s ?p ?o LATERAL { ?s ?q ?r } }', 'LATERAL')).not.toBe('keyword');
  });
});

describe('sparql({ lateral })', () => {
  const doc = 'SELECT * WHERE {\n  ?s ?p ?o\n  LATERAL {\n    ?s ?q ?r\n  }\n}';

  it('is off by default', () => {
    const state = stateFor(doc, sparql());
    expect(state.facet(language)).toBe(sparqlLanguage);
    expect(parseErrors(state)).not.toEqual([]);
  });

  it('accepts LATERAL when enabled', () => {
    const state = stateFor(doc, sparql({ lateral: true }));
    expect(state.facet(language)).toBe(sparqlLateralLanguage);
    expect(parseErrors(state)).toEqual([]);
  });

  it('still reports an error inside the LATERAL group', () => {
    expect(parseErrors(stateFor('SELECT * WHERE { ?s ?p ?o LATERAL { ?s ?p } }', sparql({ lateral: true })))).not.toEqual([]);
  });

  it('folds the LATERAL group', () => {
    expect(foldedText(stateFor(doc, sparql({ lateral: true })), 'LATERAL {')).toBe('\n    ?s ?q ?r\n  ');
  });

  it('offers LATERAL in completion only when enabled', async () => {
    expect(completionLabels(await completionsAt('SELECT * { ?s ?p ?o LAT', sparql()))).not.toContain('LATERAL');
    expect(completionLabels(await completionsAt('SELECT * { ?s ?p ?o LAT', sparql({ lateral: true })))).toContain(
      'LATERAL'
    );
  });
});
