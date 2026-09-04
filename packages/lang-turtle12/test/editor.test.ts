import { describe, expect, it } from 'vitest';
import { nquads, ntriples, trig, turtle } from '../dist/index.js';
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
  it.each([
    ['turtle', turtle()],
    ['trig', trig()],
    ['ntriples', ntriples()],
    ['nquads', nquads()],
  ])('attaches the %s language', (name, support) => {
    expect(languageName(stateFor('', support))).toBe(name);
  });

  it('declares the comment token so toggle-comment works', () => {
    const state = stateFor('ex:s ex:p ex:o .', turtle());
    expect(state.languageDataAt<{ line: string }>('commentTokens', 0)[0]).toEqual({ line: '#' });
  });
});

describe('folding', () => {
  it('folds a blank-node property list', () => {
    const state = stateFor('ex:s ex:p [\n  ex:q ex:r ;\n  ex:q2 ex:r2\n] .\n', turtle());
    expect(foldedText(state, 'ex:s ex:p [')).toBe('\n  ex:q ex:r ;\n  ex:q2 ex:r2\n');
  });

  it('folds a collection', () => {
    const state = stateFor('ex:s ex:p (\n  ex:a\n  ex:b\n) .\n', turtle());
    expect(foldedText(state, 'ex:s ex:p (')).toBe('\n  ex:a\n  ex:b\n');
  });

  it('folds an annotation block', () => {
    const state = stateFor('ex:s ex:p ex:o {|\n  ex:q ex:r\n|} .\n', turtle());
    expect(foldedText(state, 'ex:s ex:p ex:o {|')).toBe('\n  ex:q ex:r\n');
  });

  it('folds a TriG graph block, named or bare', () => {
    const named = stateFor('GRAPH ex:g {\n  ex:s ex:p ex:o .\n}\n', trig());
    expect(foldedText(named, 'GRAPH')).toBe('\n  ex:s ex:p ex:o .\n');

    const bare = stateFor('ex:g {\n  ex:s ex:p ex:o .\n}\n', trig());
    expect(foldedText(bare, 'ex:g {')).toBe('\n  ex:s ex:p ex:o .\n');
  });

  it('folds a statement from the end of its first line', () => {
    const state = stateFor('ex:s\n  ex:p ex:o ;\n  ex:p2 ex:o2 .\n', turtle());
    expect(foldedText(state, 'ex:s\n')).toBe('\n  ex:p ex:o ;\n  ex:p2 ex:o2');
  });

  it('lets a bracket on the same line fold instead of the statement', () => {
    // Folding the statement here would hide the `] .` too, leaving what is
    // left looking unterminated.
    const state = stateFor('ex:s ex:p [\n  ex:q ex:r\n] .\n', turtle());
    expect(foldedText(state, 'ex:s ex:p [')).toBe('\n  ex:q ex:r\n');
  });

  it('offers no fold on a one-line statement', () => {
    const state = stateFor('ex:s ex:p ex:o .\n', turtle());
    expect(foldableLines(state)).toEqual([]);
  });

  it('offers no fold in N-Triples, which has no nesting', () => {
    const state = stateFor('<http://s> <http://p> <http://o> .\n', ntriples());
    expect(foldableLines(state)).toEqual([]);
  });
});

describe('indentation', () => {
  it('indents inside a blank-node property list', () => {
    const state = stateFor('ex:s ex:p [\nex:q ex:r\n] .\n', turtle());
    expect(indentAt(state, 'ex:q')).toBe(2);
  });

  it('dedents the closing bracket to its opener', () => {
    const state = stateFor('ex:s ex:p [\n  ex:q ex:r\n] .\n', turtle());
    expect(indentAt(state, '] .')).toBe(0);
  });

  it('indents inside a collection', () => {
    const state = stateFor('ex:s ex:p (\nex:a\n) .\n', turtle());
    expect(indentAt(state, 'ex:a')).toBe(2);
  });

  it('indents inside a TriG graph block, and dedents its close', () => {
    const state = stateFor('ex:g {\nex:s ex:p ex:o .\n}\n', trig());
    expect(indentAt(state, 'ex:s')).toBe(2);
    expect(indentAt(state, '}')).toBe(0);
  });

  it('indents nested structures cumulatively', () => {
    const state = stateFor('ex:g {\n  ex:s ex:p [\nex:q ex:r\n  ] .\n}\n', trig());
    expect(indentAt(state, 'ex:q')).toBe(4);
  });

  it('indents inside an annotation block', () => {
    const state = stateFor('ex:s ex:p ex:o {|\nex:q ex:r\n|} .\n', turtle());
    expect(indentAt(state, 'ex:q')).toBe(2);
  });
});

describe('completion', () => {
  it('offers the directives and term keywords', async () => {
    const labels = completionLabels(await completionsAt('@pre', turtle()));
    expect(labels).toContain('@prefix');
    expect(labels).toContain('@base');
    expect(labels).toContain('PREFIX');
    expect(labels).toContain('true');
    expect(labels).toContain('a');
  });

  it('offers GRAPH only in TriG', async () => {
    expect(completionLabels(await completionsAt('GR', trig()))).toContain('GRAPH');
    expect(completionLabels(await completionsAt('GR', turtle()))).not.toContain('GRAPH');
  });

  it("offers the document's own prefixes, read from the tree", async () => {
    const doc = '@prefix ex: <http://e/> .\nPREFIX foaf: <http://xmlns.com/foaf/0.1/>\nfo';
    const options = await completionsAt(doc, turtle());
    expect(completionLabels(options)).toContain('ex:');
    expect(completionLabels(options)).toContain('foaf:');
    expect(options.find((o) => o.label === 'foaf:')?.detail).toBe('http://xmlns.com/foaf/0.1/');
  });

  it('offers prefixes from an external source too', async () => {
    const labels = completionLabels(
      await completionsAt('sk', turtle({ prefixSource: { skos: 'http://www.w3.org/2004/02/skos/core#' } }))
    );
    expect(labels).toContain('skos:');
  });

  it('lets the document win over the external source', async () => {
    const options = await completionsAt(
      '@prefix ex: <http://document/> .\nex',
      turtle({ prefixSource: { ex: 'http://external/' } })
    );
    expect(options.find((o) => o.label === 'ex:')?.detail).toBe('http://document/');
  });

  it('accepts a function as the prefix source', async () => {
    const labels = completionLabels(await completionsAt('dy', turtle({ prefixSource: () => ({ dyn: 'http://d/' }) })));
    expect(labels).toContain('dyn:');
  });

  it.each(['# a com', 'ex:s ex:p "some tex', "ex:s ex:p 'some tex", 'ex:s ex:p <http://ex'])(
    'stays quiet inside %j',
    async (doc) => {
      expect(await completionsAt(doc, turtle())).toEqual([]);
    }
  );

  it('still offers completion inside a half-typed reified triple', async () => {
    // `<<` must not read as the start of an IRI.
    const labels = completionLabels(await completionsAt('@prefix ex: <http://e/> .\n<< ex', turtle()));
    expect(labels).toContain('ex:');
  });

  it('offers nothing after a space unless asked explicitly', async () => {
    expect(await completionsAt('ex:s ', turtle())).toEqual([]);
    expect(completionLabels(await completionsAt('ex:s ', turtle(), true))).toContain('a');
  });
});
