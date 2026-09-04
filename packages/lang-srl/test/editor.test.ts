import { describe, expect, it } from 'vitest';
import { dataBlockRanges, ruleRanges, srl, tupleRanges, variablesInDataBlocks } from '../dist/index.js';
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
  it('attaches the srl language', () => {
    expect(languageName(stateFor('', srl()))).toBe('srl');
  });

  it('declares the comment token so toggle-comment works', () => {
    const state = stateFor('RULE {} WHERE {}', srl());
    expect(state.languageDataAt<{ line: string }>('commentTokens', 0)[0]).toEqual({ line: '#' });
  });
});

describe('folding', () => {
  it('folds a rule head and a rule body separately', () => {
    const doc = 'RULE {\n  ?s ?p ?o\n}\nWHERE {\n  ?s ?q ?r\n}\n';
    const state = stateFor(doc, srl());
    expect(foldedText(state, 'RULE {')).toBe('\n  ?s ?p ?o\n');
    expect(foldedText(state, 'WHERE {')).toBe('\n  ?s ?q ?r\n');
    expect(foldableLines(state)).toEqual([1, 4]);
  });

  it('folds a DATA block', () => {
    const state = stateFor('DATA {\n  <http://s> <http://p> 1\n}\n', srl());
    expect(foldedText(state, 'DATA {')).toBe('\n  <http://s> <http://p> 1\n');
  });

  it('folds a negation inside a body', () => {
    const doc = 'RULE {} WHERE {\n  NOT {\n    ?s ?p ?o\n  }\n}\n';
    const state = stateFor(doc, srl());
    expect(foldedText(state, 'NOT {')).toBe('\n    ?s ?p ?o\n  ');
  });

  it('offers no fold on a one-line rule', () => {
    expect(foldableLines(stateFor('RULE {} WHERE {}\n', srl()))).toEqual([]);
  });
});

describe('indentation', () => {
  it('indents inside a rule body and dedents its close', () => {
    const state = stateFor('RULE {} WHERE {\n?s ?p ?o\n}\n', srl());
    expect(indentAt(state, '?s')).toBe(2);
    expect(indentAt(state, '}')).toBe(0);
  });

  it('indents inside a rule head', () => {
    const state = stateFor('RULE {\n?s ?p ?o\n} WHERE {}\n', srl());
    expect(indentAt(state, '?s')).toBe(2);
  });

  it('indents inside a DATA block', () => {
    const state = stateFor('DATA {\n<http://s> <http://p> 1\n}\n', srl());
    expect(indentAt(state, '<http://s>')).toBe(2);
  });

  it('indents a negation cumulatively', () => {
    const state = stateFor('RULE {} WHERE {\n  NOT {\n?s ?p ?o\n  }\n}\n', srl());
    expect(indentAt(state, '?s')).toBe(4);
  });
});

describe('completion', () => {
  it('offers the SRL keywords', async () => {
    const labels = completionLabels(await completionsAt('RU', srl()));
    expect(labels).toContain('RULE');
    const inBody = completionLabels(await completionsAt('RULE {} WHERE { S', srl()));
    expect(inBody).toContain('SET');
    expect(inBody).toContain('TUPLE');
  });

  it('offers SPARQL keywords and functions too', async () => {
    const labels = completionLabels(await completionsAt('RULE {} WHERE { FIL', srl()));
    expect(labels).toContain('FILTER');
    expect(completionLabels(await completionsAt('RULE {} WHERE { FILTER(isTR', srl()))).toContain('isTRIPLE');
  });

  it('leaves TUPLE out when the extension is off', async () => {
    expect(completionLabels(await completionsAt('RULE {} WHERE { TU', srl({ tuples: false })))).not.toContain(
      'TUPLE'
    );
    expect(completionLabels(await completionsAt('RULE {} WHERE { TU', srl({ tuples: true })))).toContain('TUPLE');
  });

  it("offers the document's prefixes and variables", async () => {
    const doc = 'PREFIX ex: <http://e/>\nRULE {} WHERE { ?subject ex:p ?o . FILTER(?su';
    const options = await completionsAt(doc, srl());
    expect(completionLabels(options)).toContain('ex:');
    expect(completionLabels(options)).toContain('?subject');
  });
});

describe('what an application needs from the tree', () => {
  /*
   * The plan's point about the stratum gutter: with `Rule` and `DataBlock` in
   * the tree, block boundaries are known locally and only the stratum numbers
   * need a server round trip, so the gutter stops lagging a keystroke behind.
   */
  it('reports each rule as its own range', () => {
    const doc = 'RULE {} WHERE {}\nRULE <http://r> {} WHERE DATA {}\n';
    const state = stateFor(doc, srl());
    const ranges = ruleRanges(state);
    expect(ranges.length).toBe(2);
    expect(doc.slice(ranges[0].from, ranges[0].to)).toBe('RULE {} WHERE {}');
    expect(doc.slice(ranges[1].from, ranges[1].to)).toBe('RULE <http://r> {} WHERE DATA {}');
  });

  it('reports each DATA block as its own range', () => {
    const doc = 'DATA { <http://s> <http://p> 1 }\nRULE {} WHERE {}\nDATA { <http://s> <http://p> 2 }';
    const state = stateFor(doc, srl());
    expect(dataBlockRanges(state).map((r) => doc.slice(r.from, r.to))).toEqual([
      'DATA { <http://s> <http://p> 1 }',
      'DATA { <http://s> <http://p> 2 }',
    ]);
  });

  it('reports tuple spans, labelled by position', () => {
    const doc = 'RULE { TUPLE( ?a ) } WHERE { TUPLE( ?b ) }';
    const state = stateFor(doc, srl({ tuples: false }));
    expect(tupleRanges(state)).toEqual([
      { from: doc.indexOf('TUPLE( ?a )'), to: doc.indexOf('TUPLE( ?a )') + 11, kind: 'TupleTemplate' },
      { from: doc.indexOf('TUPLE( ?b )'), to: doc.indexOf('TUPLE( ?b )') + 11, kind: 'TuplePattern' },
    ]);
  });

  it('reports a variable in a DATA block with the variable own span', () => {
    // The four `syntax-data-bad` entries the grammar deliberately accepts: a
    // linter can underline `?o` rather than the whole block.
    const doc = 'PREFIX : <http://e/>\nDATA { :s :p ?o }';
    const state = stateFor(doc, srl());
    expect(variablesInDataBlocks(state)).toEqual([
      { from: doc.indexOf('?o'), to: doc.indexOf('?o') + 2, name: '?o' },
    ]);
  });

  it('reports no variables for a ground DATA block', () => {
    const state = stateFor('PREFIX : <http://e/>\nDATA { :s :p :o }', srl());
    expect(variablesInDataBlocks(state)).toEqual([]);
  });

  it('does not mistake a rule body variable for a DATA block one', () => {
    const state = stateFor('RULE {} WHERE DATA { ?s ?p ?o }', srl());
    // `WHERE DATA { … }` is a rule body, not a ground data block.
    expect(variablesInDataBlocks(state)).toEqual([]);
    expect(dataBlockRanges(state)).toEqual([]);
  });
});
