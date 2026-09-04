import { describe, expect, it } from 'vitest';
import { parser } from '../dist/index.js';
import { parser as sparqlParser } from 'codemirror-lang-sparql12';
import { allTextOf, nodeNames, parsesCleanly, shapeOf, textOf } from '../../../test/harness';

const span = (text: string, name: string) => textOf(parser, text, name);
const has = (text: string, name: string) => nodeNames(parser, text).has(name);

describe('rule sets', () => {
  it('reads the one rule production', () => {
    expect(shapeOf(parser, 'RULE {} WHERE {}')).toBe('SrlUnit(RuleSet(Rule(KwRULE,HeadTemplate,KwWHERE,BodyPattern)))');
  });

  it('reads an optional rule IRI', () => {
    expect(span('RULE <http://r> {} WHERE {}', 'IRIRef')).toBe('<http://r>');
    expect(span('PREFIX : <http://e/>\nRULE :r {} WHERE {}', 'PNameLN')).toBe(':r');
  });

  it('reads the optional DATA modifier on the body', () => {
    expect(has('RULE {} WHERE DATA {}', 'KwDATA')).toBe(true);
    expect(has('RULE {} WHERE {}', 'KwDATA')).toBe(false);
  });

  it('reads a prologue anywhere in the rule set', () => {
    const text = 'PREFIX a: <http://a/>\nRULE {} WHERE {}\nPREFIX b: <http://b/>\nRULE {} WHERE {}';
    expect(parsesCleanly(parser, text)).toBe(true);
    expect(allTextOf(parser, text, 'PNameNS')).toEqual(['a:', 'b:']);
  });

  it('reads several rules and data blocks in any order', () => {
    const text = 'DATA { <http://s> <http://p> 1 }\nRULE {} WHERE {}\nDATA { <http://s> <http://p> 2 }';
    expect(parsesCleanly(parser, text)).toBe(true);
    expect(allTextOf(parser, text, 'SrlDataBlock').length).toBe(2);
    expect(allTextOf(parser, text, 'Rule').length).toBe(1);
  });

  it('reads an empty document', () => {
    expect(parsesCleanly(parser, '')).toBe(true);
    expect(parsesCleanly(parser, '# just a comment\n')).toBe(true);
  });
});

describe('body items', () => {
  it('reads a negation, with and without the DATA modifier', () => {
    expect(span('RULE {} WHERE { NOT { ?s ?p ?o } }', 'Negation')).toBe('NOT { ?s ?p ?o }');
    expect(span('RULE {} WHERE { NOT DATA { ?s ?p ?o } }', 'Negation')).toBe('NOT DATA { ?s ?p ?o }');
  });

  it('reads a bare NOT without shadowing NOT EXISTS or NOT IN', () => {
    expect(has('RULE {} WHERE { NOT { ?s ?p ?o } }', 'Negation')).toBe(true);
    expect(has('RULE {} WHERE { FILTER NOT EXISTS { ?s ?p ?o } }', 'NotExistsFunc')).toBe(true);
    expect(has('RULE {} WHERE { FILTER(?a NOT IN (1,2)) }', 'Negation')).toBe(false);
    expect(parsesCleanly(parser, 'RULE {} WHERE { FILTER(?a NOT IN (1,2)) }')).toBe(true);
  });

  it('reads a filter', () => {
    expect(span('RULE {} WHERE { FILTER(?x > 1) }', 'Filter')).toBe('FILTER(?x > 1)');
  });

  it('reads a SET assignment, with := as one token', () => {
    const text = 'RULE {} WHERE { SET ( ?y := ?x + 1 ) }';
    expect(parsesCleanly(parser, text)).toBe(true);
    expect(span(text, 'Assignment')).toBe('SET ( ?y := ?x + 1 )');
    expect(span(text, 'AssignOp')).toBe(':=');
    // The bug this guards: `:=` lexing as an empty prefix followed by `=`.
    expect(has(text, 'PNameNS')).toBe(false);
  });

  it('reads triples with the path hierarchy', () => {
    const text = 'PREFIX : <http://e/>\nRULE {} WHERE { ?x ^:p1/^:p2 ?o }';
    expect(parsesCleanly(parser, text)).toBe(true);
    expect(span(text, 'VerbPath')).toBe('^:p1/^:p2');
  });

  it('reads several body items separated by optional dots', () => {
    const text = 'RULE {} WHERE { ?s ?p ?o . FILTER(?o > 1) SET ( ?y := 1 ) . ?a ?b ?c }';
    expect(parsesCleanly(parser, text)).toBe(true);
  });
});

describe('the rule-tuples extension', () => {
  it('names a tuple for its position', () => {
    const text = 'RULE { TUPLE( ?a, ?b ) } WHERE { TUPLE( ?a, 1 ) }';
    expect(parsesCleanly(parser, text)).toBe(true);
    expect(span(text, 'TupleTemplate')).toBe('TUPLE( ?a, ?b )');
    expect(span(text, 'TuplePattern')).toBe('TUPLE( ?a, 1 )');
  });

  it('requires at least one term', () => {
    expect(parsesCleanly(parser, 'RULE {} WHERE { TUPLE() }')).toBe(false);
    expect(parsesCleanly(parser, 'RULE {} WHERE { TUPLE( ?a ) }')).toBe(true);
  });

  it('mixes tuples and triples in a head', () => {
    const text = 'PREFIX : <http://e/>\nRULE { :s :p :o . TUPLE( ?a ) } WHERE {}';
    expect(parsesCleanly(parser, text)).toBe(true);
    expect(has(text, 'TupleTemplate')).toBe(true);
    expect(has(text, 'TriplesSameSubject')).toBe(true);
  });
});

describe('SRL keywords do not shadow prefixed names', () => {
  /*
   * `RULE`, `SET`, `TUPLE` and `DATA` are ordinary words, so `:set` and
   * `set:p` must still read as names. They will, because `:` starts a
   * different token — but that is the kind of "obviously fine" that is worth a
   * test, since the whole keyword mechanism depends on it.
   */
  it.each([':set', ':rule', ':data', ':tuple', ':not'])('reads %s as a local name', (name) => {
    const text = `PREFIX : <http://e/>\nRULE {} WHERE { ?s ${name} ?o }`;
    expect(parsesCleanly(parser, text)).toBe(true);
    expect(allTextOf(parser, text, 'PNameLN')).toContain(name);
  });

  it.each(['set:p', 'rule:p', 'tuple:p'])('reads %s as a prefixed name', (name) => {
    const text = `PREFIX ${name.split(':')[0]}: <http://e/>\nRULE {} WHERE { ?s ${name} ?o }`;
    expect(parsesCleanly(parser, text)).toBe(true);
    expect(allTextOf(parser, text, 'PNameLN')).toContain(name);
  });

  it.each(['?set', '?rule', '?tuple', '?data'])('reads %s as a variable', (name) => {
    const text = `RULE {} WHERE { ${name} ?p ?o }`;
    expect(parsesCleanly(parser, text)).toBe(true);
    expect(allTextOf(parser, text, 'Var1')).toContain(name);
  });

  it('accepts SRL keywords in any casing', () => {
    expect(parsesCleanly(parser, 'rule {} where { not { ?s ?p ?o } set ( ?y := 1 ) }')).toBe(true);
    expect(parsesCleanly(parser, 'RuLe {} WhErE { TuPlE( ?a ) }')).toBe(true);
  });
});

describe('SRL and SPARQL share their terms', () => {
  /*
   * The reason the two languages are one grammar. If these ever diverged, an
   * author would see a triple term coloured one way in a query and another in
   * a rule — and the two parsers would disagree about the document.
   */
  const sparql = sparqlParser.configure({ top: 'SparqlUnit' });

  it.each([
    '?s ?p <<( ?a ?b ?c )>>',
    '<< ?a ?b ?c ~?r >> ?p ?o',
    '?s <http://p> ?o {| <http://q> ?z |}',
    '?s <http://p> "x"@en--ltr',
    '?s <http://p> "x"^^<http://t>',
    'FILTER(isTRIPLE(?t))',
    'FILTER(?a NOT IN (1,2))',
    '?s <http://p>/<http://q>? ?o',
    '[ <http://p> ?o ] <http://q> ?z',
    '?s <http://p> ( <http://a> <http://b> )',
  ])('reads %j the same in both entry points', (fragment) => {
    const asSrl = `RULE {} WHERE { ${fragment} }`;
    const asQuery = `ASK { ${fragment} }`;
    expect(parsesCleanly(parser, asSrl)).toBe(true);
    expect(parsesCleanly(sparql, asQuery)).toBe(true);

    /*
     * Same node names, in the same order, for the same fragment. Only nodes
     * wholly inside the fragment count — the enclosing rule and query differ
     * by construction — and one container name is ignored: SPARQL wraps a
     * pattern in `GroupGraphPatternSub` where SRL's body is the rule's own,
     * which is the deliberate difference between the two entry points. Every
     * node below that must match exactly.
     */
    const ignore = new Set(['GroupGraphPatternSub']);
    const names = (p: typeof parser, text: string) => {
      const out: string[] = [];
      const start = text.indexOf(fragment);
      const end = start + fragment.length;
      p.parse(text).iterate({
        from: start,
        to: end,
        enter: (n) => {
          if (n.from >= start && n.to <= end && !ignore.has(n.name)) out.push(n.name);
        },
      });
      return out;
    };
    expect(names(parser, asSrl)).toEqual(names(sparql, asQuery));
  });
});
