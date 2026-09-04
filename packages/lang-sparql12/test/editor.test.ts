import { describe, expect, it } from 'vitest';
import { sparql } from '../dist/index.js';
import {
  completionLabels,
  completionsAt,
  foldableLines,
  foldedText,
  indentAt,
  languageName,
  stateFor,
} from '../../../test/editor';

describe('language wiring', () => {
  it('attaches the sparql language', () => {
    expect(languageName(stateFor('', sparql()))).toBe('sparql');
  });

  it('declares the comment token so toggle-comment works', () => {
    const state = stateFor('ASK { ?s ?p ?o }', sparql());
    expect(state.languageDataAt<{ line: string }>('commentTokens', 0)[0]).toEqual({ line: '#' });
  });
});

describe('folding', () => {
  it('folds a group graph pattern', () => {
    const state = stateFor('SELECT * {\n  ?s ?p ?o\n}\n', sparql());
    expect(foldedText(state, 'SELECT')).toBe('\n  ?s ?p ?o\n');
  });

  it('folds a nested pattern independently', () => {
    const state = stateFor('SELECT * {\n  OPTIONAL {\n    ?s ?p ?o\n  }\n}\n', sparql());
    expect(foldedText(state, 'OPTIONAL')).toBe('\n    ?s ?p ?o\n  ');
    expect(foldableLines(state)).toEqual([1, 2]);
  });

  it('folds a construct template and a quad pattern', () => {
    const construct = stateFor('CONSTRUCT {\n  ?s ?p ?o\n} WHERE {\n  ?s ?p ?o\n}\n', sparql());
    expect(foldedText(construct, 'CONSTRUCT')).toBe('\n  ?s ?p ?o\n');

    const update = stateFor('INSERT DATA {\n  <http://s> <http://p> 1\n}\n', sparql());
    expect(foldedText(update, 'INSERT')).toBe('\n  <http://s> <http://p> 1\n');
  });

  it('folds a bracketed expression, outermost first', () => {
    // On a line where several brackets open, CodeMirror takes the outermost
    // fold that still starts on that line — here the `FILTER(…)` expression
    // rather than the argument list inside it.
    const args = stateFor('ASK {\n  FILTER(ex:f(\n    ?a,\n    ?b\n  ))\n}\n', sparql());
    expect(foldedText(args, 'FILTER')).toBe('ex:f(\n    ?a,\n    ?b\n  )');
  });

  it('folds a VALUES block without swallowing its brace', () => {
    const values = stateFor('ASK {\n  VALUES ?x {\n    1\n    2\n  }\n}\n', sparql());
    expect(foldedText(values, 'VALUES')).toBe('\n    1\n    2\n  ');
  });

  it('folds an annotation block', () => {
    const state = stateFor('ASK {\n  ?s ex:p ?o {|\n    ex:q ?z\n  |}\n}\n', sparql());
    expect(foldedText(state, '{|')).toBe('\n    ex:q ?z\n  ');
  });

  it('offers no fold on a one-line query', () => {
    expect(foldableLines(stateFor('ASK { ?s ?p ?o }\n', sparql()))).toEqual([]);
  });
});

describe('indentation', () => {
  it('indents inside a group graph pattern and dedents its close', () => {
    const state = stateFor('SELECT * {\n?s ?p ?o\n}\n', sparql());
    expect(indentAt(state, '?s')).toBe(2);
    expect(indentAt(state, '}')).toBe(0);
  });

  it('indents nested patterns cumulatively', () => {
    const state = stateFor('SELECT * {\n  OPTIONAL {\n?s ?p ?o\n  }\n}\n', sparql());
    expect(indentAt(state, '?s')).toBe(4);
  });

  it('indents inside an argument list', () => {
    const state = stateFor('ASK { FILTER(ex:f(\n?a\n)) }\n', sparql());
    expect(indentAt(state, '?a')).toBeGreaterThan(0);
  });

  it('indents inside a blank-node property list', () => {
    const state = stateFor('ASK { [\nex:p ?o\n] ex:q ?z }\n', sparql());
    expect(indentAt(state, 'ex:p')).toBeGreaterThan(0);
  });

  it('indents inside a quad pattern', () => {
    const state = stateFor('INSERT DATA {\n<http://s> <http://p> 1\n}\n', sparql());
    expect(indentAt(state, '<http://s>')).toBe(2);
  });
});

describe('completion', () => {
  it('offers keywords', async () => {
    const labels = completionLabels(await completionsAt('SEL', sparql()));
    expect(labels).toContain('SELECT');
    expect(labels).toContain('CONSTRUCT');
  });

  it('offers update keywords', async () => {
    const labels = completionLabels(await completionsAt('INS', sparql()));
    expect(labels).toContain('INSERT DATA');
    expect(labels).toContain('INSERT');
  });

  it('offers built-in functions with their canonical spelling', async () => {
    const labels = completionLabels(await completionsAt('ASK { FILTER(isTR', sparql()));
    expect(labels).toContain('isTRIPLE');
    expect(labels).toContain('hasLANG');
    expect(labels).toContain('STRLANGDIR');
    expect(labels).toContain('sameTerm');
  });

  it('offers the aggregates', async () => {
    const labels = completionLabels(await completionsAt('SELECT (GROUP_', sparql()));
    expect(labels).toContain('GROUP_CONCAT');
  });

  it("offers the document's own prefixes", async () => {
    const doc = 'PREFIX ex: <http://e/>\nPREFIX foaf: <http://xmlns.com/foaf/0.1/>\nSELECT * { ?s fo';
    const options = await completionsAt(doc, sparql());
    expect(completionLabels(options)).toContain('foaf:');
    expect(options.find((o) => o.label === 'foaf:')?.detail).toBe('http://xmlns.com/foaf/0.1/');
  });

  it('offers prefixes from an external source, with the document winning', async () => {
    const external = { skos: 'http://www.w3.org/2004/02/skos/core#', ex: 'http://external/' };
    expect(completionLabels(await completionsAt('SELECT * { ?s sk', sparql({ prefixSource: external })))).toContain(
      'skos:'
    );
    const options = await completionsAt(
      'PREFIX ex: <http://document/>\nSELECT * { ?s ex',
      sparql({ prefixSource: external })
    );
    expect(options.find((o) => o.label === 'ex:')?.detail).toBe('http://document/');
  });

  it('offers the variables the document already uses', async () => {
    const options = await completionsAt('SELECT * { ?subject ?predicate $obj . FILTER(?su', sparql());
    const labels = completionLabels(options);
    expect(labels).toContain('?subject');
    expect(labels).toContain('?predicate');
    expect(labels).toContain('$obj');
    expect(options.find((o) => o.label === '?subject')?.type).toBe('variable');
  });

  it.each(['# a com', 'ASK { ?s ?p "some tex', 'ASK { ?s ?p <http://ex'])('stays quiet inside %j', async (doc) => {
    expect(await completionsAt(doc, sparql())).toEqual([]);
  });

  it('still offers completion inside a half-typed reified triple', async () => {
    const labels = completionLabels(await completionsAt('PREFIX ex: <http://e/>\nASK { << ex', sparql()));
    expect(labels).toContain('ex:');
  });

  it('offers nothing after a space unless asked explicitly', async () => {
    expect(await completionsAt('SELECT * { ', sparql())).toEqual([]);
    expect(completionLabels(await completionsAt('SELECT * { ', sparql(), true))).toContain('FILTER');
  });
});
