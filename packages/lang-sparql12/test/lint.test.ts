import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { syntaxTree } from '@codemirror/language';
import { parseErrors, parser, sparql } from '../dist/index.js';
import { errorRanges, readCorpus } from '../../../test/harness';
import { stateFor } from '../../../test/editor';

const corpus = join(dirname(fileURLToPath(import.meta.url)), 'corpus');
const errorsIn = (doc: string) => parseErrors(stateFor(doc, sparql()));

describe('parseErrors', () => {
  it('reports nothing for a valid query', () => {
    expect(errorsIn('SELECT * WHERE { ?s ?p ?o }')).toEqual([]);
  });

  it('merges a run of stray words into one error', () => {
    expect(errorsIn('this is a test\nSELECT * WHERE { ?s ?p ?o }')).toEqual([
      { from: 0, to: 14, message: 'Unexpected “this is a test”.' },
    ]);
  });

  it('merges a run across a comment and a line break', () => {
    expect(errorsIn('this is # a comment\n a test\nSELECT * WHERE { ?s ?p ?o }')).toHaveLength(1);
  });

  it('keeps two mistakes on one line apart', () => {
    expect(errorsIn('SELECT * WHERE { ?s ?p ?o ) . ?a ?b ?c ) }')).toEqual([
      { from: 26, to: 27, message: 'Unexpected “)”.' },
      { from: 39, to: 40, message: 'Unexpected “)”.' },
    ]);
  });

  it('reports a missing token where the parser stopped', () => {
    expect(errorsIn('SELECT * WHERE { ?s ?p ?o\n')).toEqual([{ from: 26, to: 26, message: 'Syntax error.' }]);
  });

  it('shortens a long run in the message', () => {
    const [error] = errorsIn('SELECT * WHERE { ?s ?p ?o } and then a long run of stray words after the query');
    expect(error.message).toBe('Unexpected “and then a long run of stray wor…”.');
  });

  describe('in a document too long to parse at once', () => {
    // Many small groups, because one group of over about 1,000 triples hits a
    // parser limit and reports errors of its own; see the next test.
    const doc = 'SELECT * WHERE {\n' + '  { ?s <http://e/p> ?o }\n'.repeat(20000) + '}\n';

    it('is only partly parsed when the editor state is created', () => {
      expect(syntaxTree(stateFor(doc, sparql())).length).toBeLessThan(doc.length);
    });

    it('reports nothing when the document is valid', () => {
      expect(errorsIn(doc)).toEqual([]);
    });

    it('reports an error at the end', () => {
      const broken = doc.replace(/}\n$/, '?s ?p\n}\n');
      expect(errorsIn(broken)).toEqual([{ from: broken.length - 2, to: broken.length - 2, message: 'Syntax error.' }]);
    });
  });

  it('reports nothing for a block of 1,000 triples', () => {
    expect(errorsIn('INSERT DATA {\n' + '  <http://e/s> <http://e/p> 1 .\n'.repeat(1000) + '}\n')).toEqual([]);
  });
});

describe('parseErrors agrees with the parser on the W3C corpus', () => {
  const sparqlParser = parser.configure({ top: 'SparqlUnit' });
  const groups = [
    'sparql11-query',
    'sparql11-update',
    'sparql11-fed',
    'sparql12-syntax',
    'sparql12-triple-terms-positive',
    'sparql12-triple-terms-negative',
    'sparql12-version',
    'sparql12-lang-basedir',
    'sparql12-codepoint-escapes',
  ];

  it.each(groups)('%s', (group) => {
    const disagreements = readCorpus(join(corpus, group)).filter((entry) => {
      const text = readFileSync(join(corpus, group, entry.file), 'utf8');
      return (errorRanges(sparqlParser, text).length > 0) !== (errorsIn(text).length > 0);
    });
    expect(disagreements.map((entry) => entry.name)).toEqual([]);
  });
});
