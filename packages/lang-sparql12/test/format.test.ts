import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EditorState } from '@codemirror/state';
import { formatSparql, formatSparqlDocument, parser, sparql } from '../dist/index.js';
import { checkCorpus } from '../../../test/format';

const here = dirname(fileURLToPath(import.meta.url));
const sparqlParser = parser.configure({ top: 'SparqlUnit' });

// sparql12-lang-basedir and sparql12-codepoint-escapes have no positive syntax tests.
describe.each([
  'sparql11-query',
  'sparql11-update',
  'sparql11-fed',
  'sparql12-syntax',
  'sparql12-triple-terms-positive',
  'sparql12-version',
])('formatting the W3C %s suite', (group) => {
  const { checked, problems } = checkCorpus(sparqlParser, join(here, 'corpus', group), (text) => formatSparql(text));

  it('checks at least one document', () => expect(checked).toBeGreaterThan(0));
  it('changes only whitespace and is idempotent', () => expect(problems).toEqual([]));
});

const format = (text: string) => {
  const result = formatSparql(text);
  expect(result.error).toBeNull();
  return result.text;
};

describe('formatSparql', () => {
  it('starts each clause on its own line and indents groups', () => {
    expect(
      format('PREFIX ex: <http://e/> SELECT ?s (COUNT( DISTINCT ?o ) AS ?n) WHERE { ?s ex:p ?o } GROUP BY ?s ORDER BY DESC(?n)'),
    ).toBe(
      [
        'PREFIX ex: <http://e/>',
        'SELECT ?s (COUNT(DISTINCT ?o) AS ?n)',
        'WHERE {',
        '  ?s ex:p ?o',
        '}',
        'GROUP BY ?s',
        'ORDER BY DESC(?n)',
      ].join('\n'),
    );
  });

  it('keeps sqlib parameter placeholders as written', () => {
    expect(format('SELECT * { VALUES ?x { UNDEF } ?x ?p ?o } LIMIT 0001 OFFSET 0002')).toBe(
      ['SELECT * {', '  VALUES ?x { UNDEF }', '  ?x ?p ?o', '}', 'LIMIT 0001', 'OFFSET 0002'].join('\n'),
    );
  });

  it('indents nested patterns and puts each row of a VALUES table on its own line', () => {
    expect(
      format('SELECT * WHERE { ?s ?p ?o . OPTIONAL { ?s ex:q ?q FILTER(?q>1) } { ?a ?b ?c } UNION { ?d ?e ?f } VALUES (?a ?b) { (1 2) (UNDEF 3) } }'),
    ).toBe(
      [
        'SELECT *',
        'WHERE {',
        '  ?s ?p ?o .',
        '  OPTIONAL {',
        '    ?s ex:q ?q',
        '    FILTER(?q > 1)',
        '  }',
        '  {',
        '    ?a ?b ?c',
        '  } UNION {',
        '    ?d ?e ?f',
        '  }',
        '  VALUES (?a ?b) {',
        '    (1 2)',
        '    (UNDEF 3)',
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('normalises the spaces in expressions and paths without joining tokens', () => {
    expect(format('SELECT * { ?s ex:p / ^ ex:q * ?o FILTER ( ! BOUND( ?o ) || ?o - 1 > - 1 ) BIND ( - ?o AS ?n ) }')).toBe(
      ['SELECT * {', '  ?s ex:p/^ex:q* ?o', '  FILTER(!BOUND(?o) || ?o - 1 > - 1)', '  BIND(-?o AS ?n)', '}'].join('\n'),
    );
  });

  it('lays out triple patterns as Turtle does', () => {
    expect(format('SELECT * { ?s ex:p ?a , ?b ; ex:q [ ex:r ?c ; ex:t ?d ] }')).toBe(
      ['SELECT * {', '  ?s ex:p ?a,', '      ?b ;', '    ex:q [', '      ex:r ?c ;', '      ex:t ?d', '    ]', '}'].join('\n'),
    );
  });

  it('starts each update operation on its own line', () => {
    expect(format('INSERT DATA { ex:a ex:b ex:c } ; DELETE { ?s ?p ?o } WHERE { ?s ?p ?o } ; CLEAR ALL')).toBe(
      ['INSERT DATA {', '  ex:a ex:b ex:c', '} ;', 'DELETE {', '  ?s ?p ?o', '}', 'WHERE {', '  ?s ?p ?o', '} ;', 'CLEAR ALL'].join(
        '\n',
      ),
    );
  });

  it('keeps comments and number lexemes', () => {
    expect(format('# head\nSELECT * { ?s ?p 1.0 # trailing\n}')).toBe(['# head', 'SELECT * {', '  ?s ?p 1.0 # trailing', '}'].join('\n'));
  });

  it('parses LATERAL only when asked', () => {
    const text = 'SELECT * { ?s ?p ?o LATERAL { ?s ?q ?r } }';
    expect(formatSparql(text).error).not.toBeNull();
    expect(formatSparql(text, { lateral: true }).text).toBe(
      ['SELECT * {', '  ?s ?p ?o', '  LATERAL {', '    ?s ?q ?r', '  }', '}'].join('\n'),
    );
  });

  it('returns a document with a parse error unchanged and reports where', () => {
    const result = formatSparql('SELECT * WHERE { ?s ?p }');
    expect(result.text).toBe('SELECT * WHERE { ?s ?p }');
    expect(result.error).not.toBeNull();
  });
});

describe('formatSparqlDocument', () => {
  it('formats a SPARQL editor and maps the selection', () => {
    let state = EditorState.create({ doc: 'SELECT * { ?s ?p ?o }', selection: { anchor: 14 }, extensions: [sparql()] });
    expect(formatSparqlDocument({ state, dispatch: (tr) => (state = tr.state) })).toBe(true);
    expect(state.doc.toString()).toBe('SELECT * {\n  ?s ?p ?o\n}');
    expect(state.doc.sliceString(state.selection.main.head, state.selection.main.head + 2)).toBe('?p');
  });

  it('uses the lateral dialect in a lateral editor', () => {
    let state = EditorState.create({ doc: 'SELECT * { {} LATERAL { ?s ?p ?o } }', extensions: [sparql({ lateral: true })] });
    expect(formatSparqlDocument({ state, dispatch: (tr) => (state = tr.state) })).toBe(true);
  });
});
