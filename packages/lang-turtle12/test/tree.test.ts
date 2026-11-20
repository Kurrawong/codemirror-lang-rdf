import { describe, expect, it } from 'vitest';
import { parser } from '../dist/index.js';
const turtleParser = parser;
import { parsesCleanly, shapeOf } from '../../../test/harness';

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

  it('reads VERSION as the first statement, with Turtle\'s node names', () => {
    expect(shape('NTriplesDoc', 'VERSION "1.2"\n<http://s> <http://p> <http://o> .')).toBe(
      'NTriplesDoc(Version(KwVersion,VersionSpecifier),NTriple(IRIRef,IRIRef,IRIRef))'
    );
    expect(shape('NQuadsDoc', 'VERSION "1.2"\n<http://s> <http://p> <http://o> <http://g> .')).toBe(
      'NQuadsDoc(Version(KwVersion,VersionSpecifier),NQuad(IRIRef,IRIRef,IRIRef,GraphLabel(IRIRef)))'
    );
  });

  it('rejects the VERSION forms that only Turtle has, and VERSION after a triple', () => {
    const nt = parser.configure({ top: 'NTriplesDoc' });
    for (const text of [
      'version "1.2"',
      '@version "1.2" .',
      'VERSION """1.2"""',
      '<http://s> <http://p> <http://o> .\nVERSION "1.2"',
    ])
      expect(parsesCleanly(nt, text)).toBe(false);
  });

  it('accepts only a double-quoted one-line string and a full datatype IRI', () => {
    const nt = parser.configure({ top: 'NTriplesDoc' });
    expect(shape('NTriplesDoc', '<http://s> <http://p> "x"^^<http://dt> .')).toBe(
      'NTriplesDoc(NTriple(IRIRef,IRIRef,RDFLiteral(String,Datatype(IRIRef))))'
    );
    for (const literal of ["'x'", '"""x"""', "'''x'''", '"x"^^ex:dt'])
      expect(parsesCleanly(nt, `<http://s> <http://p> ${literal} .`)).toBe(false);
    expect(parsesCleanly(nt, '<http://s> <http://p> <<( <http://a> <http://b> \'x\' )>> .')).toBe(false);
  });

  it('rejects a prefixed name as predicate', () => {
    expect(parsesCleanly(parser.configure({ top: 'NTriplesDoc' }), '_:a :p <http://o> .')).toBe(false);
    expect(parsesCleanly(parser.configure({ top: 'NQuadsDoc' }), '_:abc:def <http://p> <http://o> .')).toBe(false);
  });
});

describe('PN_CHARS_BASE above U+FFFF', () => {
  // [163s] ends with #x10000-#xEFFFF. Lezer reads these as surrogate pairs.
  const turtle = parser.configure({ top: 'TurtleDoc' });

  it('accepts the first and last code points in prefixes, local names and blank node labels', () => {
    for (const c of ['\u{10000}', '\u{EFFFF}']) {
      expect(parsesCleanly(turtle, `@prefix p${c}: <http://a/> .`)).toBe(true);
      expect(parsesCleanly(turtle, `@prefix p: <http://a/> .\np:${c} p:b p:c .`)).toBe(true);
      expect(parsesCleanly(turtle, `_:b${c} <http://a/p> <http://a/o> .`)).toBe(true);
    }
  });

  it('rejects the code point after the range', () => {
    expect(parsesCleanly(turtle, '@prefix p: <http://a/> .\np:\u{F0000} p:b p:c .')).toBe(false);
  });
});

describe('RDF Patch', () => {
  const patch = (text: string) => shape('RdfPatchDoc', text);

  it('reads headers, a transaction, and add and delete rows', () => {
    const text = [
      'H id <urn:p:1> .',
      'H prev <urn:p:0> .',
      'TX .',
      'D <http://s> <http://p> "old"@en .',
      'A <http://s> <http://p> "new" <http://g> .',
      'TC .',
    ].join('\n');
    expect(patch(text)).toBe(
      'RdfPatchDoc(Header(KwH,HeaderKey,IRIRef),Header(KwH,HeaderKey,IRIRef),' +
        'Transaction(TxBegin(KwTX),QuadDelete(KwD,IRIRef,IRIRef,RDFLiteral(String,LangDir)),' +
        'QuadAdd(KwA,IRIRef,IRIRef,RDFLiteral(String),GraphLabel(IRIRef)),TxCommit(KwTC)))'
    );
  });

  it('reads a prefix name quoted or unquoted', () => {
    expect(patch('PA "ex" <http://e/> .\nPA ex <http://e/> .\nPD "" .')).toBe(
      'RdfPatchDoc(PrefixAdd(KwPA,String,IRIRef),PrefixAdd(KwPA,PatchPrefix,IRIRef),PrefixDelete(KwPD,String))'
    );
  });

  it('reads both spellings of a blank node, and a triple term', () => {
    expect(patch('A _:b0 <http://p> <_:b1> .')).toBe('RdfPatchDoc(QuadAdd(KwA,BlankNodeLabel,IRIRef,IRIRef))');
    expect(patch('A <http://s> <http://p> <<( <http://a> <http://b> "x" )>> .')).toBe(
      'RdfPatchDoc(QuadAdd(KwA,IRIRef,IRIRef,NTripleTerm(IRIRef,IRIRef,RDFLiteral(String))))'
    );
  });

  it('reads an aborted transaction', () => {
    expect(patch('TX .\nA <http://s> <http://p> <http://o> .\nTA .')).toBe(
      'RdfPatchDoc(Transaction(TxBegin(KwTX),QuadAdd(KwA,IRIRef,IRIRef,IRIRef),TxAbort(KwTA)))'
    );
  });

  it('rejects a prefixed name, a lowercase op code, and a row without its dot', () => {
    const parser = turtleParser.configure({ top: 'RdfPatchDoc' });
    expect(parsesCleanly(parser, 'A ex:s <http://p> <http://o> .')).toBe(false);
    expect(parsesCleanly(parser, 'a <http://s> <http://p> <http://o> .')).toBe(false);
    expect(parsesCleanly(parser, 'A <http://s> <http://p> <http://o>')).toBe(false);
    expect(parsesCleanly(parser, 'TX .\nA <http://s> <http://p> <http://o> .')).toBe(false);
  });

  it('takes literals in N-Triples syntax, in rows and headers', () => {
    // The specification writes terms "in N-triples syntax": "..." strings and
    // full datatype IRIs only. A quoted prefix name is not a term.
    const parser = turtleParser.configure({ top: 'RdfPatchDoc' });
    for (const literal of ["'x'", '"""x"""', '"x"^^ex:dt']) {
      expect(parsesCleanly(parser, `A <http://s> <http://p> ${literal} .`)).toBe(false);
      expect(parsesCleanly(parser, `H note ${literal} .`)).toBe(false);
    }
    expect(parsesCleanly(parser, 'H note "x"^^<http://dt> .')).toBe(true);
    expect(parsesCleanly(parser, "PA 'ex' <http://e/> .")).toBe(true);
  });
});
