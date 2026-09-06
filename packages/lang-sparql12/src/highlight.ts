import type { NodePropSource } from '@lezer/common';
import { styleTags, tags as t } from '@lezer/highlight';
import { KEYWORD_NODE_NAMES } from './keywords';

/**
 * The shared highlight-tag table, SPARQL and SRL half.
 *
 * `docs/highlight-tags.md` is the canonical table; the repository-root test
 * asserts this and the Turtle grammar agree on every shared construct, so an
 * application can keep one `HighlightStyle` for all six languages.
 *
 * The keyword rule is built from `KEYWORD_NODE_NAMES` rather than written out.
 * A hand-written list of 125 node names would go stale the first time a
 * keyword was added, and silently: the new keyword would simply be uncoloured.
 */
export const sparqlHighlighting: NodePropSource = styleTags({
  Comment: t.comment,

  /*
   * `true` and `false` are keyword *terms* in the grammar — SPARQL spells its
   * booleans as words — but they are RDF literals, and the shared tag table
   * tags them `bool` so a style colours them like the literals they are. They
   * are the only two keyword nodes that are not tagged `keyword`.
   */
  [KEYWORD_NODE_NAMES.filter((name) => name !== 'KwTRUE' && name !== 'KwFALSE').join(' ')]: t.keyword,
  'KwTRUE KwFALSE': t.bool,

  IRIRef: t.url,
  'PNameNS PNameLN': t.namespace,

  'Var1 Var2': t.variableName,

  'BlankNodeLabel Anon': t.propertyName,

  'String VersionSpecifier': t.string,
  'Integer Decimal Double IntegerPositive DecimalPositive DoublePositive IntegerNegative DecimalNegative DoubleNegative':
    t.number,

  LangDir: t.annotation,
  'Datatype/IRIRef Datatype/PrefixedName/PNameNS Datatype/PrefixedName/PNameLN': t.typeName,
  'Datatype/"^^"': t.typeName,

  /*
   * The RDF 1.2 term brackets are tagged apart from ordinary grouping, because
   * `<< s p o >>` and `<<( s p o )>>` differ by one character and mean quite
   * different things — a statement you can refer to, versus an object that *is*
   * a triple. A style that cannot separate them cannot help a reader see that.
   *
   * Each is a `special()` of the standard tag its glyphs actually are, so the
   * fallback chain does the work: a theme that knows nothing about RDF 1.2 and
   * styles `bracket` (or `brace`/`paren`/`angleBracket`) still colours all of
   * them, and one that wants the distinction overrides the specific tag.
   */

  /*
   * Every token *inside* an RDF 1.2 nested-triple construct also carries
   * `quote`, so a style can shade the whole thing and not just its brackets —
   * which is what "colour reified triples differently" usually means. The
   * `/...` form applies to descendants and *combines* with each token's own
   * tag, so an IRI inside a reified triple is `quote url`, not one or the
   * other. A style that never mentions `quote` sees no change at all.
   *
   * One tag for all three constructs, rather than three: the brackets above
   * already say which kind it is, and a style wanting per-kind regions can add
   * its own props to the exported parser.
   */
  'ReifiedTriple/... TripleTerm/... TripleTermData/... ExprTripleTerm/... AnnotationBlock/... AnnotationBlockPath/...':
    t.quote,

  '"<<" ">>"': t.special(t.angleBracket),
  '"<<(" ")>>"': t.special(t.paren),
  '"{|" "|}"': t.special(t.brace),
  '"{" "}"': t.brace,
  '"[" "]"': t.squareBracket,
  '"(" ")" Nil': t.paren,

  'OrOp AndOp CompareOp ArithOp MulOp NotOp AssignOp "^" "|" "?" "*" "+" "="': t.operator,
  // The reifier marker, told from arithmetic; it falls back to `operator`.
  '"~"': t.special(t.operator),

  '";" ","': t.separator,
  '"."': t.punctuation,
});
