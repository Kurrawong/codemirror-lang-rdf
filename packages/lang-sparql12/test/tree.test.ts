import { describe, expect, it } from 'vitest';
import { parser } from '../dist/index.js';
import { allTextOf, nodeNames, parsesCleanly, shapeOf, textOf } from '../../../test/harness';

/**
 * Tree-shape tests.
 *
 * SPARQL's expression grammar is seven productions tall before it reaches a
 * leaf, so a full shape expectation for a `FILTER` would be almost entirely
 * wrappers. Where that is the case these tests name the node under test and
 * assert what it spans, which says the same thing about the part that matters;
 * the term-level productions, where the whole shape is the point, are written
 * out in full.
 */
const sparql = parser.configure({ top: 'SparqlUnit' });
const P = 'PrefixedName(PNameLN)';

const has = (text: string, name: string) => nodeNames(sparql, text).has(name);
const span = (text: string, name: string) => textOf(sparql, text, name);

describe('prologue', () => {
  it('reads BASE, PREFIX and VERSION', () => {
    expect(shapeOf(sparql, 'BASE <http://b/>')).toBe('SparqlUnit(Prologue(BaseDecl(KwBASE,IRIRef)))');
    expect(shapeOf(sparql, 'PREFIX ex: <http://e/>')).toBe(
      'SparqlUnit(Prologue(PrefixDecl(KwPREFIX,PNameNS,IRIRef)))'
    );
    expect(shapeOf(sparql, 'VERSION "1.2"')).toBe('SparqlUnit(Prologue(VersionDecl(KwVERSION,VersionSpecifier)))');
  });

  it('accepts a bare prologue, which is neither a query nor an update', () => {
    expect(parsesCleanly(sparql, 'PREFIX ex: <http://e/>')).toBe(true);
    expect(parsesCleanly(sparql, '')).toBe(true);
  });
});

describe('keywords are case-insensitive and not reserved', () => {
  it.each(['SELECT', 'select', 'SeLeCt'])('reads %s', (kw) => {
    expect(has(`${kw} * { ?s ?p ?o }`, 'SelectQuery')).toBe(true);
  });

  it('reads a keyword spelling as a variable name', () => {
    expect(span('SELECT ?select { ?s ?p ?o }', 'Var')).toBe('?select');
  });

  it('reads a keyword spelling as a prefix label', () => {
    expect(span('SELECT * { ?s select:p ?o }', 'PNameLN')).toBe('select:p');
    expect(span('PREFIX filter: <http://e/>', 'PNameNS')).toBe('filter:');
  });

  it('reads a $-sigil variable', () => {
    expect(shapeOf(sparql, 'ASK { $s ?p ?o }')).toContain('Var(Var2)');
  });
});

describe('query forms', () => {
  it.each([
    ['SELECT * { ?s ?p ?o }', 'SelectQuery'],
    ['CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }', 'ConstructQuery'],
    ['CONSTRUCT WHERE { ?s ?p ?o }', 'ConstructQuery'],
    ['DESCRIBE * WHERE { ?s ?p ?o }', 'DescribeQuery'],
    ['DESCRIBE <http://x>', 'DescribeQuery'],
    ['ASK { ?s ?p ?o }', 'AskQuery'],
  ])('reads %j as %s', (text, form) => {
    expect(has(text, form)).toBe(true);
    expect(parsesCleanly(sparql, text)).toBe(true);
  });

  it('reads a sub-select', () => {
    expect(has('SELECT * { SELECT * { ?s ?p ?o } }', 'SubSelect')).toBe(true);
  });

  it('reads the solution modifiers', () => {
    const q = 'SELECT ?p { ?s ?p ?o } GROUP BY ?p HAVING (COUNT(?s) > 1) ORDER BY DESC(?p) LIMIT 10 OFFSET 5';
    for (const name of ['GroupClause', 'HavingClause', 'OrderClause', 'LimitClause', 'OffsetClause'])
      expect(has(q, name)).toBe(true);
    expect(parsesCleanly(sparql, q)).toBe(true);
  });

  it('reads a trailing VALUES clause', () => {
    expect(span('SELECT ?x { } VALUES ?x { 1 2 }', 'ValuesClause')).toBe('VALUES ?x { 1 2 }');
  });
});

describe('update forms', () => {
  it.each([
    ['LOAD <http://r>', 'Load'],
    ['LOAD SILENT <http://r> INTO GRAPH <http://g>', 'Load'],
    ['CLEAR ALL', 'Clear'],
    ['DROP GRAPH <http://g>', 'Drop'],
    ['CREATE SILENT GRAPH <http://g>', 'Create'],
    ['ADD DEFAULT TO GRAPH <http://g>', 'Add'],
    ['MOVE GRAPH <http://a> TO DEFAULT', 'Move'],
    ['COPY DEFAULT TO DEFAULT', 'Copy'],
    ['INSERT DATA { <http://s> <http://p> "o" }', 'InsertData'],
    ['DELETE DATA { <http://s> <http://p> "o" }', 'DeleteData'],
    ['DELETE WHERE { ?s ?p ?o }', 'DeleteWhere'],
    ['DELETE { ?s ?p ?o } INSERT { ?s ?p "x" } WHERE { ?s ?p ?o }', 'Modify'],
    ['WITH <http://g> DELETE { ?s ?p ?o } USING <http://u> WHERE { ?s ?p ?o }', 'Modify'],
  ])('reads %j as %s', (text, form) => {
    expect(has(text, form)).toBe(true);
    expect(parsesCleanly(sparql, text)).toBe(true);
  });

  it('reads a sequence, with a prologue after the separator', () => {
    const text = 'INSERT DATA { <http://s> <http://p> 1 } ; PREFIX ex: <http://e/> DROP ALL';
    expect(parsesCleanly(sparql, text)).toBe(true);
    expect(allTextOf(sparql, text, 'PNameNS')).toEqual(['ex:']);
  });

  it('allows a trailing separator but not a doubled one', () => {
    expect(parsesCleanly(sparql, 'DROP ALL ;')).toBe(true);
    expect(parsesCleanly(sparql, 'DROP ALL ;; DROP ALL')).toBe(false);
  });
});

describe('graph patterns', () => {
  it.each([
    ['SELECT * { { ?s ?p ?o } UNION { ?a ?b ?c } }', 'GroupOrUnionGraphPattern'],
    ['SELECT * { OPTIONAL { ?s ?p ?o } }', 'OptionalGraphPattern'],
    ['SELECT * { MINUS { ?s ?p ?o } }', 'MinusGraphPattern'],
    ['SELECT * { GRAPH ?g { ?s ?p ?o } }', 'GraphGraphPattern'],
    ['SELECT * { SERVICE SILENT ?e { ?s ?p ?o } }', 'ServiceGraphPattern'],
    ['SELECT * { FILTER(?a > 1) }', 'Filter'],
    ['SELECT * { BIND(1 AS ?x) }', 'Bind'],
    ['SELECT * { VALUES ?x { 1 } }', 'InlineData'],
  ])('reads %j as %s', (text, name) => {
    expect(has(text, name)).toBe(true);
    expect(parsesCleanly(sparql, text)).toBe(true);
  });

  it('reads property paths', () => {
    const text = 'SELECT * { ?s ex:p/ex:q?/^ex:r|ex:t*/ex:u+ ?o }';
    expect(parsesCleanly(sparql, text)).toBe(true);
    expect(allTextOf(sparql, text, 'PathMod')).toEqual(['?', '*', '+']);
    expect(span(text, 'VerbPath')).toBe('ex:p/ex:q?/^ex:r|ex:t*/ex:u+');
  });

  it.each(['?', '*', '+'])('reads the %s path modifier on its own', (mod) => {
    /*
     * `+` had to be tested separately, and by name: it is the one modifier that
     * shares its spelling with an arithmetic operator, and no test in the
     * vendored corpus uses it, so a precedence that made `+` lex as arithmetic
     * everywhere went unnoticed until someone typed `ex:p+/ex:q` into the demo.
     */
    const text = `SELECT * { ?s ex:p${mod} ?o }`;
    expect(parsesCleanly(sparql, text)).toBe(true);
    expect(span(text, 'PathMod')).toBe(mod);
  });

  it('still tells a path modifier from a signed literal', () => {
    // `[ :p+ 1 ]` is a one-or-more path; `[ :p +1 ]` is a positive literal.
    const withMod = 'ASK { [ ex:p+ 1 ] ex:q ?z }';
    expect(parsesCleanly(sparql, withMod)).toBe(true);
    expect(span(withMod, 'PathMod')).toBe('+');

    const withLiteral = 'ASK { [ ex:p +1 ] ex:q ?z }';
    expect(parsesCleanly(sparql, withLiteral)).toBe(true);
    expect(span(withLiteral, 'NumericLiteralPositive')).toBe('+1');
    expect(has(withLiteral, 'PathMod')).toBe(false);

    // And arithmetic still works where arithmetic belongs.
    expect(span('ASK { FILTER(?a + 1 > 2) }', 'ArithOp')).toBe('+');
  });

  it('reads a negated property set', () => {
    const text = 'SELECT * { ?s !(ex:p|^ex:q) ?o }';
    expect(parsesCleanly(sparql, text)).toBe(true);
    expect(span(text, 'PathNegatedPropertySet')).toBe('(ex:p|^ex:q)');
  });

  it('distinguishes a variable verb from a path verb', () => {
    expect(span('SELECT * { ?s ?p ?o }', 'VerbSimple')).toBe('?p');
    expect(span('SELECT * { ?s ex:p ?o }', 'VerbPath')).toBe('ex:p');
  });
});

describe('RDF 1.2 terms', () => {
  it('reads a triple term as an object', () => {
    const text = 'ASK { ?s ?p <<( ?a ?b ?c )>> }';
    expect(parsesCleanly(sparql, text)).toBe(true);
    expect(span(text, 'TripleTerm')).toBe('<<( ?a ?b ?c )>>');
  });

  it('reads a reified triple as a subject and as an object', () => {
    expect(span('ASK { << ?a ?b ?c >> ?p ?o }', 'ReifiedTriple')).toBe('<< ?a ?b ?c >>');
    expect(span('ASK { ?s ?p << ?a ?b ?c >> }', 'ReifiedTriple')).toBe('<< ?a ?b ?c >>');
  });

  it('reads a reifier, named, variable or anonymous', () => {
    expect(span('ASK { << ?a ?b ?c ~ex:r >> ?p ?o }', 'Reifier')).toBe('~ex:r');
    expect(span('ASK { << ?a ?b ?c ~?r >> ?p ?o }', 'Reifier')).toBe('~?r');
    expect(span('ASK { << ?a ?b ?c ~ >> ?p ?o }', 'Reifier')).toBe('~');
  });

  it('reads an annotation block', () => {
    const text = 'ASK { ?s ex:p ?o {| ex:q ?z |} }';
    expect(parsesCleanly(sparql, text)).toBe(true);
    expect(span(text, 'AnnotationBlockPath')).toBe('{| ex:q ?z |}');
  });

  it('refuses a literal as a triple term subject', () => {
    expect(parsesCleanly(sparql, 'ASK { ?s ?p <<( "lit" ex:q ex:z )>> }')).toBe(false);
    expect(parsesCleanly(sparql, 'ASK { <<"lit" ex:q ex:z>> ?p ?o }')).toBe(false);
  });

  it('reads the three restricted forms in their own positions', () => {
    expect(span('ASK { VALUES ?x { <<( ex:s ex:p 1 )>> } }', 'TripleTermData')).toBe('<<( ex:s ex:p 1 )>>');
    expect(span('ASK { BIND(<<( ?s ?p ?o )>> AS ?t) }', 'ExprTripleTerm')).toBe('<<( ?s ?p ?o )>>');
  });

  it('refuses a nested triple term where the restricted forms forbid it', () => {
    expect(parsesCleanly(sparql, 'ASK { VALUES ?x { <<( <<(ex:s ex:p 1)>> ex:q ex:z )>> } }')).toBe(false);
    expect(parsesCleanly(sparql, 'ASK { BIND(<<( <<(ex:s ex:p 1)>> ex:q ex:z )>> AS ?X) }')).toBe(false);
  });

  it('reads the 1.2 built-ins', () => {
    for (const [text, name] of [
      ['ASK { FILTER(isTRIPLE(?t)) }', 'isTRIPLE'],
      ['ASK { FILTER(SUBJECT(?t) = ?s) }', 'SUBJECT'],
      ['ASK { FILTER(PREDICATE(?t) = ?p) }', 'PREDICATE'],
      ['ASK { FILTER(OBJECT(?t) = ?o) }', 'OBJECT'],
      ['ASK { FILTER(hasLANG(?x)) }', 'hasLANG'],
      ['ASK { FILTER(hasLANGDIR(?x)) }', 'hasLANGDIR'],
      ['ASK { FILTER(LANGDIR(?x) = "ltr") }', 'LANGDIR'],
    ] as const) {
      expect(parsesCleanly(sparql, text)).toBe(true);
      expect(span(text, 'FunctionName1')).toBe(name);
    }
    expect(span('ASK { FILTER(TRIPLE(?a,?b,?c) = ?t) }', 'FunctionName3')).toBe('TRIPLE');
    expect(span('ASK { FILTER(STRLANGDIR("a","en","ltr") = ?x) }', 'FunctionName3')).toBe('STRLANGDIR');
  });

  it('reads a directional language tag', () => {
    expect(span('ASK { ?s ex:p "x"@en--ltr }', 'LangDir')).toBe('@en--ltr');
  });
});

describe('expressions', () => {
  it('keeps arity in the grammar', () => {
    expect(parsesCleanly(sparql, 'ASK { FILTER(STRLEN(?a)) }')).toBe(true);
    expect(parsesCleanly(sparql, 'ASK { FILTER(STRLEN(?a, ?b)) }')).toBe(false);
    expect(parsesCleanly(sparql, 'ASK { FILTER(NOW()) }')).toBe(true);
    expect(parsesCleanly(sparql, 'ASK { FILTER(NOW(?a)) }')).toBe(false);
    expect(parsesCleanly(sparql, 'ASK { FILTER(SUBSTR(?a, 1)) }')).toBe(true);
    expect(parsesCleanly(sparql, 'ASK { FILTER(SUBSTR(?a, 1, 2)) }')).toBe(true);
    expect(parsesCleanly(sparql, 'ASK { FILTER(SUBSTR(?a, 1, 2, 3)) }')).toBe(false);
  });

  it('reads a signed literal and a subtraction differently', () => {
    // [115]: `?x -1` is an addition whose right operand is the literal -1.
    expect(span('ASK { FILTER(?x -1 > 2) }', 'NumericLiteralNegative')).toBe('-1');
    expect(has('ASK { FILTER(?x - 1 > 2) }', 'NumericLiteralNegative')).toBe(false);
    expect(span('ASK { FILTER(?x - 1 > 2) }', 'ArithOp')).toBe('-');
  });

  it('reads IN and NOT IN', () => {
    expect(parsesCleanly(sparql, 'ASK { FILTER(?a IN (1,2)) }')).toBe(true);
    expect(parsesCleanly(sparql, 'ASK { FILTER(?a NOT IN (1,2)) }')).toBe(true);
  });

  it('reads EXISTS and NOT EXISTS', () => {
    expect(has('ASK { FILTER EXISTS { ?s ?p ?o } }', 'ExistsFunc')).toBe(true);
    expect(has('ASK { FILTER NOT EXISTS { ?s ?p ?o } }', 'NotExistsFunc')).toBe(true);
  });

  it('reads the aggregates', () => {
    for (const call of [
      'COUNT(*)',
      'COUNT(DISTINCT ?s)',
      'SUM(?s)',
      'MIN(?s)',
      'MAX(?s)',
      'AVG(?s)',
      'SAMPLE(?s)',
      'GROUP_CONCAT(?s)',
      'GROUP_CONCAT(DISTINCT ?s ; SEPARATOR = ",")',
    ])
      expect(parsesCleanly(sparql, `SELECT (${call} AS ?x) { ?s ?p ?o }`)).toBe(true);
  });

  it('reads a user-defined function call', () => {
    // [69] reaches it as a Constraint; inside an expression the same text is
    // [127] IriOrFunction, which is an iri that *may* carry an argument list.
    expect(span('ASK { FILTER ex:f(?a, ?b) }', 'FunctionCall')).toBe('ex:f(?a, ?b)');
    expect(span('ASK { FILTER(ex:f(?a, ?b)) }', 'IriOrFunction')).toBe('ex:f(?a, ?b)');
    expect(span('ASK { FILTER(ex:f = 1) }', 'IriOrFunction')).toBe('ex:f');
  });
});

describe('triples', () => {
  it('reads a construct template with the non-path hierarchy', () => {
    expect(shapeOf(sparql, 'CONSTRUCT { ex:s ex:p ex:o } WHERE { }')).toBe(
      'SparqlUnit(Prologue,Query(ConstructQuery(KwCONSTRUCT,ConstructTemplate(ConstructTriples(' +
        `TriplesSameSubject(${P},PropertyListNotEmpty(Verb(${P}),ObjectList(Object(${P})))))),` +
        'WhereClause(KwWHERE,GroupGraphPattern(GroupGraphPatternSub)),SolutionModifier)))'
    );
  });

  it('reads collections and blank-node property lists', () => {
    expect(span('ASK { ?s ex:p ( ex:a ex:b ) }', 'CollectionPath')).toBe('( ex:a ex:b )');
    expect(span('ASK { [ ex:p ?o ] ex:q ?z }', 'BlankNodePropertyListPath')).toBe('[ ex:p ?o ]');
    expect(span('ASK { ?s ex:p () }', 'Nil')).toBe('()');
    expect(span('ASK { ?s ex:p [] }', 'Anon')).toBe('[]');
  });
});
