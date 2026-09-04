import { describe, expect, it } from 'vitest';
import { parser } from '../dist/index.js';
import { shapeOf } from '../../../test/harness';

/**
 * Tree-shape tests: what a consumer walking the tree by spec vocabulary sees.
 *
 * Written out rather than snapshotted, because the point is that node names
 * stay the W3C production names. A snapshot would record a rename as
 * "accepted"; a literal expectation records it as a decision someone made.
 *
 * `P` and `V` stand in for the two shapes that appear in almost every triple,
 * so the interesting part of each expectation is the part that differs.
 */
const P = 'PrefixedName(PNameLN)';
const V = `Verb(${P})`;
const shape = (top: string, text: string) => shapeOf(parser.configure({ top }), text);

/** `ex:s ex:p <object>` with the object's shape spliced in. */
const triple = (object: string) => `Triples(${P},PredicateObjectList(${V},ObjectList(${object})))`;

describe('Turtle directives', () => {
  it('reads both spellings of prefix and base', () => {
    expect(shape('TurtleDoc', '@prefix ex: <http://e/> .')).toBe(
      'TurtleDoc(Directive(PrefixID(AtPrefix,PNameNS,IRIRef)))'
    );
    expect(shape('TurtleDoc', '@base <http://e/> .')).toBe('TurtleDoc(Directive(Base(AtBase,IRIRef)))');
    expect(shape('TurtleDoc', 'PREFIX ex: <http://e/>')).toBe(
      'TurtleDoc(Directive(SparqlPrefix(KwPrefix,PNameNS,IRIRef)))'
    );
    expect(shape('TurtleDoc', 'BASE <http://e/>')).toBe('TurtleDoc(Directive(SparqlBase(KwBase,IRIRef)))');
  });

  it('accepts any casing for the SPARQL-style directives', () => {
    for (const text of ['PREFIX ex: <http://e/>', 'prefix ex: <http://e/>', 'PreFiX ex: <http://e/>'])
      expect(shape('TurtleDoc', text)).toBe('TurtleDoc(Directive(SparqlPrefix(KwPrefix,PNameNS,IRIRef)))');
  });

  it('reads both spellings of VERSION', () => {
    expect(shape('TurtleDoc', 'VERSION "1.2"')).toBe('TurtleDoc(Directive(Version(KwVersion,VersionSpecifier)))');
    expect(shape('TurtleDoc', '@version "1.2" .')).toBe('TurtleDoc(Directive(Version(AtVersion,VersionSpecifier)))');
  });
});

describe('Turtle literals', () => {
  it('carries a language tag, with or without a direction', () => {
    for (const tag of ['@en', '@en-GB', '@en--ltr', '@en--rtl'])
      expect(shape('TurtleDoc', `ex:s ex:p "x"${tag} .`)).toBe(`TurtleDoc(${triple('RDFLiteral(String,LangDir)')})`);
  });

  it('carries a datatype', () => {
    expect(shape('TurtleDoc', 'ex:s ex:p "x"^^xsd:string .')).toBe(
      `TurtleDoc(${triple(`RDFLiteral(String,Datatype(${P}))`)})`
    );
  });

  it('distinguishes the three numeric forms', () => {
    expect(shape('TurtleDoc', 'ex:s ex:p 1 .')).toBe(`TurtleDoc(${triple('NumericLiteral(Integer)')})`);
    expect(shape('TurtleDoc', 'ex:s ex:p 1.5 .')).toBe(`TurtleDoc(${triple('NumericLiteral(Decimal)')})`);
    expect(shape('TurtleDoc', 'ex:s ex:p 1.5e3 .')).toBe(`TurtleDoc(${triple('NumericLiteral(Double)')})`);
  });

  it('reads booleans', () => {
    expect(shape('TurtleDoc', 'ex:s ex:p true .')).toBe(`TurtleDoc(${triple('BooleanLiteral(True)')})`);
    expect(shape('TurtleDoc', 'ex:s ex:p false .')).toBe(`TurtleDoc(${triple('BooleanLiteral(False)')})`);
  });

  it('reads long string literals', () => {
    for (const text of ['ex:s ex:p """a "b" c""" .', "ex:s ex:p '''a 'b' c''' ."])
      expect(shape('TurtleDoc', text)).toBe(`TurtleDoc(${triple('RDFLiteral(String)')})`);
  });
});

describe('RDF 1.2 terms', () => {
  it('makes a triple term an object', () => {
    expect(shape('TurtleDoc', 'ex:s ex:p <<( ex:a ex:b ex:c )>> .')).toBe(
      `TurtleDoc(${triple(`TripleTerm(${P},${V},${P})`)})`
    );
  });

  it('nests triple terms', () => {
    expect(shape('TurtleDoc', 'ex:s ex:p <<( ex:a ex:b <<( ex:c ex:d ex:e )>> )>> .')).toBe(
      `TurtleDoc(${triple(`TripleTerm(${P},${V},TripleTerm(${P},${V},${P}))`)})`
    );
  });

  it('makes a reified triple a subject', () => {
    expect(shape('TurtleDoc', '<< ex:a ex:b ex:c >> ex:p ex:o .')).toBe(
      `TurtleDoc(Triples(ReifiedTriple(${P},${V},${P}),PredicateObjectList(${V},ObjectList(${P}))))`
    );
  });

  it('carries a reifier inside a reified triple', () => {
    expect(shape('TurtleDoc', '<< ex:a ex:b ex:c ~ex:r >> ex:p ex:o .')).toBe(
      `TurtleDoc(Triples(ReifiedTriple(${P},${V},${P},Reifier(${P})),PredicateObjectList(${V},ObjectList(${P}))))`
    );
  });

  it('lets a reified triple stand alone as a statement', () => {
    expect(shape('TurtleDoc', '<< ex:a ex:b ex:c >> .')).toBe(`TurtleDoc(Triples(ReifiedTriple(${P},${V},${P})))`);
  });

  it('attaches an annotation block to an object', () => {
    expect(shape('TurtleDoc', 'ex:s ex:p ex:o {| ex:q ex:r |} .')).toBe(
      `TurtleDoc(${triple(`${P},Annotation(AnnotationBlock(PredicateObjectList(${V},ObjectList(${P}))))`)})`
    );
  });

  it('repeats reifier-and-annotation pairs', () => {
    const block = `AnnotationBlock(PredicateObjectList(${V},ObjectList(${P})))`;
    expect(shape('TurtleDoc', 'ex:s ex:p ex:o ~ex:r1 {| ex:q1 ex:r1 |} ~_:r2 {| ex:q2 ex:r2 |} .')).toBe(
      `TurtleDoc(${triple(
        `${P},Annotation(Reifier(${P}),${block},Reifier(BlankNode(BlankNodeLabel)),${block})`
      )})`
    );
  });

  it('reads an anonymous reifier', () => {
    expect(shape('TurtleDoc', 'ex:s ex:p ex:o ~ {| ex:q ex:r |} .')).toBe(
      `TurtleDoc(${triple(`${P},Annotation(Reifier,AnnotationBlock(PredicateObjectList(${V},ObjectList(${P}))))`)})`
    );
  });
});

describe('Turtle structure', () => {
  it('reads collections, property lists and anonymous blank nodes', () => {
    expect(shape('TurtleDoc', 'ex:s a [ ex:q ( ex:a _:b [] ) ] .')).toBe(
      `TurtleDoc(Triples(${P},PredicateObjectList(Verb(KeywordA),ObjectList(` +
        `BlankNodePropertyList(PredicateObjectList(${V},ObjectList(` +
        `Collection(${P},BlankNode(BlankNodeLabel),BlankNode(Anon)))))))))`
    );
  });

  it('keeps comments in the tree', () => {
    expect(shape('TurtleDoc', '# hi\nex:s ex:p ex:o .')).toBe(
      `TurtleDoc(Comment,Triples(${P},PredicateObjectList(${V},ObjectList(${P}))))`
    );
  });
});

describe('TriG', () => {
  const inner = `TriplesBlock(Triples(${P},PredicateObjectList(${V},ObjectList(${P}))))`;

  it('reads a GRAPH statement', () => {
    expect(shape('TrigDoc', 'GRAPH ex:g { ex:s ex:p ex:o . }')).toBe(
      `TrigDoc(GraphStatement(KwGraph,LabelOrSubject(${P}),WrappedGraph(${inner})))`
    );
  });

  it('reads a bare labelled graph block', () => {
    expect(shape('TrigDoc', 'ex:g { ex:s ex:p ex:o }')).toBe(
      `TrigDoc(TriplesOrGraph(LabelOrSubject(${P}),WrappedGraph(${inner})))`
    );
  });

  it('reads a default-graph block', () => {
    expect(shape('TrigDoc', '{ ex:s ex:p ex:o }')).toBe(`TrigDoc(WrappedGraph(${inner}))`);
  });

  it('lets the same label introduce triples instead of a graph', () => {
    expect(shape('TrigDoc', 'ex:s ex:p ex:o .')).toBe(
      `TrigDoc(TriplesOrGraph(LabelOrSubject(${P}),PredicateObjectList(${V},ObjectList(${P}))))`
    );
  });
});

describe('N-Triples and N-Quads', () => {
  it('reads a plain triple', () => {
    expect(shape('NTriplesDoc', '<http://s> <http://p> <http://o> .')).toBe(
      'NTriplesDoc(NTriple(IRIRef,IRIRef,IRIRef))'
    );
  });

  it('reads a triple term as object', () => {
    expect(shape('NTriplesDoc', '<http://s> <http://p> <<( <http://a> <http://b> "x" )>> .')).toBe(
      'NTriplesDoc(NTriple(IRIRef,IRIRef,NTripleTerm(IRIRef,IRIRef,RDFLiteral(String))))'
    );
  });

  it('reads a quad with a graph label', () => {
    expect(shape('NQuadsDoc', '<http://s> <http://p> "x"@en--rtl <http://g> .')).toBe(
      'NQuadsDoc(NQuad(IRIRef,IRIRef,RDFLiteral(String,LangDir),GraphLabel(IRIRef)))'
    );
  });
});
