import { describe, expect, it } from 'vitest';
import { dataBlockRanges, ruleRanges, SRL_BASE_GRAPH_PLACEHOLDER, sparqlBindConversions, sparqlNotExistsConversions, sparqlOperationConversions, sparqlToSrl, srl, srlConformanceDiagnostics, srlToSparql, tupleRanges, variablesInDataBlocks } from '../dist/index.js';
import { parser as sparqlParser } from '@kurrawongai/codemirror-lang-sparql12';
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

describe('explicit SRL/SPARQL conversion', () => {
  it('lowers SET and NOT to their SPARQL equivalents', () => {
    const result = srlToSparql('RULE { ?s :out ?x } WHERE { ?s :in ?n . SET ( ?x := ?n + 1 ) NOT { ?s :hidden true } }');
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('CONSTRUCT { ?s :out ?x } WHERE');
    expect(result.text).toContain('BIND(?n + 1 AS ?x) FILTER(BOUND(?x))');
    expect(result.text).toContain('FILTER NOT EXISTS { ?s :hidden true }');
  });

  it('exports a rule as an INSERT update when requested', () => {
    const result = srlToSparql('RULE { ?s :out ?x } WHERE { ?s :in ?x }', { form: 'insert' });
    expect(result).toEqual({ text: 'INSERT { ?s :out ?x } WHERE { ?s :in ?x }\n', diagnostics: [] });
  });

  it('exports a DATA selection as either a construct or INSERT DATA operation', () => {
    const source = 'DATA { :hardcoded :p 1 }';
    expect(srlToSparql(source)).toEqual({ text: 'CONSTRUCT { :hardcoded :p 1 } WHERE {}\n', diagnostics: [] });
    expect(srlToSparql(source, { form: 'insert' })).toEqual({ text: 'INSERT DATA { :hardcoded :p 1 }\n', diagnostics: [] });
  });

  it('preserves a named SRL rule as an expanded IRI comment during export', () => {
    const result = srlToSparql('PREFIX ex: <http://example.org/>\nRULE ex:named { ?s :p ?o } WHERE {}');
    expect(result).toEqual({
      text: 'PREFIX ex: <http://example.org/>\n# SRL rule IRI: <http://example.org/named>\nCONSTRUCT { ?s :p ?o } WHERE {}\n',
      diagnostics: [],
    });
  });

  it('does not recover the SRL rule IRI comment during SPARQL import', () => {
    const result = sparqlToSrl('# SRL rule IRI: <http://example.org/named>\nCONSTRUCT { ?s :p ?o } WHERE {}');
    expect(result).toEqual({ text: '# SRL rule IRI: <http://example.org/named>\nRULE { ?s :p ?o } WHERE {}\n', diagnostics: [] });
  });

  it('raises BIND and its guard back to SET', () => {
    const result = sparqlToSrl('CONSTRUCT { ?s :out ?x } WHERE { ?s :in ?n . BIND(?n + 1 AS ?x) FILTER(BOUND(?x)) }');
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('RULE { ?s :out ?x } WHERE');
    expect(result.text).toContain('SET ( ?x := ?n + 1 )');
    expect(result.text).not.toContain('BOUND');
  });

  it('removes the whole standalone BOUND guard line', () => {
    const result = sparqlToSrl(`CONSTRUCT { ?s :out ?x } WHERE {
  ?s :in ?n .
  BIND(?n + 1 AS ?x)
  FILTER(BOUND(?x))
  FILTER(?n > 0)
}`);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('  SET ( ?x := ?n + 1 )\n  FILTER(?n > 0)');
    expect(result.text).not.toContain('\n\n');
  });

  it('raises FILTER NOT EXISTS back to SRL NOT', () => {
    const result = sparqlToSrl('CONSTRUCT { ?s :out true } WHERE { ?s :in true . FILTER NOT EXISTS { ?s :hidden true } }');
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain('NOT { ?s :hidden true }');
    expect(result.text).not.toContain('FILTER NOT EXISTS');
  });

  it('imports INSERT WHERE and INSERT DATA into SRL', () => {
    expect(sparqlToSrl('INSERT { ?s :out ?x } WHERE { ?s :in ?x }')).toEqual({
      text: 'RULE { ?s :out ?x } WHERE { ?s :in ?x }\n',
      diagnostics: [],
    });
    expect(sparqlToSrl('INSERT DATA { :hardcoded :p 1 }')).toEqual({
      text: 'DATA { :hardcoded :p 1 }\n',
      diagnostics: [],
    });
  });

  it('returns a location for SPARQL that SRL cannot express', () => {
    const source = 'CONSTRUCT { ?s :p ?o } WHERE { { ?s :p ?o } UNION { ?s :q ?o } }';
    const result = sparqlToSrl(source);
    expect(result.text).toBeUndefined();
    expect(result.diagnostics[0]).toMatchObject({ from: source.indexOf('{ ?s :p ?o } UNION'), message: 'GroupOrUnionGraphPattern cannot be represented in SRL.' });
  });

  it.each([
    ['UNION', 'CONSTRUCT { ?s :out ?o } WHERE { { ?s :p ?o } UNION { ?s :q ?o } }'],
    ['OPTIONAL', 'CONSTRUCT { ?s :out ?o } WHERE { ?s :p ?o OPTIONAL { ?s :q ?o } }'],
    ['MINUS', 'CONSTRUCT { ?s :out ?o } WHERE { ?s :p ?o MINUS { ?s :q ?o } }'],
    ['GRAPH', 'CONSTRUCT { ?s :out ?o } WHERE { GRAPH :g { ?s :p ?o } }'],
    ['SERVICE', 'CONSTRUCT { ?s :out ?o } WHERE { SERVICE <http://example.org/sparql> { ?s :p ?o } }'],
    ['VALUES', 'CONSTRUCT { ?s :out ?o } WHERE { ?s :p ?o VALUES ?o { 1 } }'],
    ['subquery', 'CONSTRUCT { ?s :out ?o } WHERE { { SELECT ?s ?o WHERE { ?s :p ?o } } }'],
    ['dataset clause', 'CONSTRUCT { ?s :out ?o } FROM :g WHERE { ?s :p ?o }'],
    ['solution modifier', 'CONSTRUCT { ?s :out ?o } WHERE { ?s :p ?o } ORDER BY ?s'],
    ['EXISTS', 'CONSTRUCT { ?s :out ?o } WHERE { ?s :p ?o FILTER EXISTS { ?s :q ?o } }'],
    ['SPARQL-only built-in', 'CONSTRUCT { ?s :out ?o } WHERE { ?s :p ?o FILTER(COALESCE(?o, 0) > 0) }'],
    ['path modifier', 'CONSTRUCT { ?s :out ?o } WHERE { ?s :p+ ?o }'],
    ['path alternative', 'CONSTRUCT { ?s :out ?o } WHERE { ?s (:p|:q) ?o }'],
    ['negated property path', 'CONSTRUCT { ?s :out ?o } WHERE { ?s !:p ?o }'],
  ])('refuses SPARQL %s because it has no SRL equivalent', (_name, source) => {
    const result = sparqlToSrl(source);
    expect(result.text).toBeUndefined();
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('lowers NOT DATA to a base-graph placeholder that is not a valid IRI, with a warning', () => {
    const source = 'RULE { ?x :km ?k } WHERE { ?x :miles ?m . NOT DATA { ?x :km ?old } SET ( ?k := ?m * 2 ) }';
    const result = srlToSparql(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain(`FILTER NOT EXISTS { GRAPH ${SRL_BASE_GRAPH_PLACEHOLDER} { ?x :km ?old } }`);
    expect(result.warnings).toEqual([
      expect.objectContaining({ from: source.indexOf('NOT DATA'), message: expect.stringContaining('NOT DATA was converted to GRAPH <{baseGraph}>') }),
    ]);
    const tree = sparqlParser.configure({ top: 'SparqlUnit' }).parse(result.text!);
    let parseErrors = 0;
    tree.iterate({ enter: (node) => { if (node.type.isError) parseErrors++; } });
    expect(parseErrors).toBeGreaterThan(0);
  });

  it('lowers WHERE DATA by matching the whole body in the base graph', () => {
    const result = srlToSparql('RULE { ?x :km ?k } WHERE DATA { ?x :miles ?m . NOT DATA { ?x :km ?old } NOT { ?x :z ?z } SET ( ?k := ?m * 2 ) }');
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toBe('CONSTRUCT { ?x :km ?k } WHERE { GRAPH <{baseGraph}> { ?x :miles ?m . FILTER NOT EXISTS { ?x :km ?old } '
      + 'FILTER NOT EXISTS { ?x :z ?z } BIND(?m * 2 AS ?k) FILTER(BOUND(?k)) } }\n');
    expect(result.warnings?.map((warning) => warning.message)).toEqual([expect.stringContaining('WHERE DATA was converted')]);
  });

  it('uses a supplied base graph IRI in both directions', () => {
    const options = { baseGraph: '<http://example.org/input>' };
    const srl = 'RULE { ?x :ok true } WHERE { ?x a :C . NOT DATA { ?x :bad ?y } }';
    const sparql = srlToSparql(srl, options);
    expect(sparql.text).toBe('CONSTRUCT { ?x :ok true } WHERE { ?x a :C . FILTER NOT EXISTS { GRAPH <http://example.org/input> { ?x :bad ?y } } }\n');
    expect(sparqlToSrl(sparql.text!, options)).toEqual({ text: `${srl}\n`, diagnostics: [] });
    expect(sparqlToSrl(sparql.text!).diagnostics[0]).toMatchObject({ message: 'GraphGraphPattern cannot be represented in SRL.' });
  });

  it('raises the base-graph placeholder back to NOT DATA and WHERE DATA', () => {
    expect(sparqlToSrl('CONSTRUCT { ?x :ok true } WHERE { ?x a :C . FILTER NOT EXISTS { GRAPH <{baseGraph}> { ?x :bad ?y } } }')).toEqual({
      text: 'RULE { ?x :ok true } WHERE { ?x a :C . NOT DATA { ?x :bad ?y } }\n',
      diagnostics: [],
    });
    expect(sparqlToSrl('CONSTRUCT { ?x :ok true } WHERE { GRAPH <{baseGraph}> { ?x a :C . FILTER NOT EXISTS { ?x :bad ?y } } }')).toEqual({
      text: 'RULE { ?x :ok true } WHERE DATA { ?x a :C . NOT { ?x :bad ?y } }\n',
      diagnostics: [],
    });
  });

  it('still refuses a base-graph GRAPH pattern mixed with other patterns', () => {
    const result = sparqlToSrl('CONSTRUCT { ?x :ok true } WHERE { GRAPH <{baseGraph}> { ?x a :C } ?x :q ?z }');
    expect(result.text).toBeUndefined();
    expect(result.diagnostics[0]).toMatchObject({ message: 'GraphGraphPattern cannot be represented in SRL.' });
  });

  it.each([
    ['a later triple pattern', 'RULE { ?x :ok true } WHERE { NOT { ?x :bad ?y } ?x a :C . }', '?x'],
    ['a later SET', 'RULE { ?s :p "abc" } WHERE { NOT { ?s :p "XYZ" } SET ( ?s := :sz ) }', '?s'],
  ])('warns when an SRL NOT shares a variable bound by %s', (_name, source, variable) => {
    const result = srlToSparql(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ from: source.indexOf('NOT'), message: expect.stringContaining(`before ${variable} is bound`) }),
    ]);
  });

  it('does not warn about a NOT whose shared variables are already bound', () => {
    const result = srlToSparql('RULE { ?x :ok true } WHERE { ?x a :C . NOT { ?x :bad ?y } ?x :q ?y2 }');
    expect(result.diagnostics).toEqual([]);
    expect(result.warnings).toBeUndefined();
  });

  it('warns when a SPARQL FILTER NOT EXISTS precedes the patterns that bind its variables', () => {
    const source = 'CONSTRUCT { ?s :p "abc" } WHERE { FILTER NOT EXISTS { ?s :p "XYZ" } BIND(:sz AS ?s) }';
    const result = sparqlToSrl(source);
    expect(result.text).toBe('RULE { ?s :p "abc" } WHERE { NOT { ?s :p "XYZ" } SET ( ?s := :sz ) }\n');
    expect(result.warnings).toEqual([
      expect.objectContaining({ from: source.indexOf('FILTER'), message: expect.stringContaining('Move the NOT after the patterns that bind ?s') }),
    ]);
  });

  it('refuses to convert input that parses but is not valid SRL', () => {
    const source = 'RULE { ?s :out true } WHERE { FILTER NOT EXISTS { ?s :archived true } }';
    const result = srlToSparql(source);
    expect(result.text).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        from: source.indexOf('NOT EXISTS'),
        message: 'SPARQL FILTER NOT EXISTS is not valid SRL. Use NOT { ... } instead.',
      }),
    ]);
  });

  it('prefers SRL conformance errors over parser-recovery noise', () => {
    const source = 'RULE { ?s :out ?x } WHERE { BIND(?n AS ?x) FILTER NOT EXISTS { ?s :p ?o } }';
    const result = srlToSparql(source);
    expect(result.text).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'SPARQL BIND is not valid SRL. Use SET instead.',
      'SPARQL FILTER NOT EXISTS is not valid SRL. Use NOT { ... } instead.',
    ]);
  });

  it('refuses a non-ground SRL DATA block before converting it', () => {
    const result = srlToSparql('DATA { :s :p ?value }');
    expect(result.text).toBeUndefined();
    expect(result.diagnostics[0]).toMatchObject({ message: 'Variables are not valid in an SRL DATA block.' });
  });
});

describe('accidental SPARQL BIND in SRL', () => {
  it('offers a lossless SET replacement for BIND plus its BOUND guard', () => {
    const state = stateFor('RULE {} WHERE { BIND(?n + fn(?m) AS ?x) FILTER(BOUND(?x)) }', srl());
    expect(sparqlBindConversions(state)).toEqual([
      { from: 16, to: 57, replacement: 'SET ( ?x := ?n + fn(?m) )', hasBoundGuard: true },
    ]);
  });

  it('offers SET for bare BIND and identifies that it adds SETs BOUND guard', () => {
    const state = stateFor('RULE {} WHERE { BIND(?n + 1 AS ?x) }', srl());
    expect(sparqlBindConversions(state)).toEqual([
      { from: 16, to: 34, replacement: 'SET ( ?x := ?n + 1 )', hasBoundGuard: false },
    ]);
  });
});

describe('accidental SPARQL FILTER NOT EXISTS in SRL', () => {
  it('offers the exact SRL NOT replacement', () => {
    const state = stateFor('RULE {} WHERE { FILTER NOT EXISTS { ?s :p ?o } }', srl());
    expect(sparqlNotExistsConversions(state)).toEqual([
      { from: 16, to: 46, replacement: 'NOT { ?s :p ?o }' },
    ]);
  });
});

describe('SPARQL operation openings in SRL', () => {
  it('raises CONSTRUCT and INSERT spellings to their SRL equivalents', () => {
    const construct = stateFor('CONSTRUCT ex:named { ?s :p ?o } WHERE {}', srl());
    expect(sparqlOperationConversions(construct)).toEqual([
      expect.objectContaining({ replacement: 'RULE', actionName: 'Convert SPARQL CONSTRUCT to SRL RULE' }),
    ]);
    expect(srlConformanceDiagnostics(construct)).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'SPARQL CONSTRUCT is not valid SRL. Use RULE instead.' }),
    ]));

    const insertData = stateFor('INSERT DATA { :s :p :o }', srl());
    expect(sparqlOperationConversions(insertData)).toEqual([
      expect.objectContaining({ replacement: 'DATA', actionName: 'Convert SPARQL INSERT DATA to SRL DATA' }),
    ]);
  });
});

describe('SRL conformance over the shared grammar', () => {
  it('rejects SPARQL-only expressions and property paths as SRL errors', () => {
    const doc = `RULE {} WHERE {
      BIND(?n AS ?x)
      FILTER NOT EXISTS { ?s :p ?o }
      FILTER(COALESCE(?x, 0) > 0)
      ?s :p+ ?o .
      ?s (:p|:q) ?o
    }
    DATA { :ground :p ?notGround }`;
    expect(srlConformanceDiagnostics(stateFor(doc, srl()))).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'SPARQL BIND is not valid SRL. Use SET instead.' }),
      expect.objectContaining({ message: 'SPARQL FILTER NOT EXISTS is not valid SRL. Use NOT { ... } instead.' }),
      expect.objectContaining({ message: 'SPARQL COALESCE is not valid SRL.' }),
      expect.objectContaining({ message: 'Property path modifiers (?, *, +) are not valid SRL.' }),
      expect.objectContaining({ message: 'Alternative property paths (|) are not valid SRL.' }),
      expect.objectContaining({ message: 'Variables are not valid in an SRL DATA block.' }),
    ]));
  });

  it('rejects assignments and negation nested inside an SRL NOT body', () => {
    const doc = 'RULE {} WHERE { NOT { ?s :p ?o . SET ( ?x := ?o ) NOT { ?s :hidden true } } }';
    expect(srlConformanceDiagnostics(stateFor(doc, srl()))).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: 'SET is not valid inside an SRL NOT body.' }),
      expect.objectContaining({ message: 'Nested NOT is not valid inside an SRL NOT body.' }),
    ]));
  });

  it('allows the SRL expression and path subset', () => {
    const doc = 'RULE {} WHERE { ?s ^:p/:q ?o . FILTER(STR(?o) = "x") SET ( ?x := ?o ) }';
    expect(srlConformanceDiagnostics(stateFor(doc, srl()))).toEqual([]);
  });
});
