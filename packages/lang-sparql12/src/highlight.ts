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

  [KEYWORD_NODE_NAMES.join(' ')]: t.keyword,

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

  '"<<" ">>" "<<(" ")>>" "{|" "|}"': t.brace,
  '"{" "}"': t.brace,
  '"[" "]"': t.squareBracket,
  '"(" ")" Nil': t.paren,

  'OrOp AndOp CompareOp ArithOp MulOp NotOp AssignOp "~" "^" "|" "?" "*" "+" "="': t.operator,

  '";" ","': t.separator,
  '"."': t.punctuation,
});
