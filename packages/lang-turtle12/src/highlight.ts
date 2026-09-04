import type { NodePropSource } from '@lezer/common';
import { styleTags, tags as t } from '@lezer/highlight';

/**
 * The shared highlight-tag table, Turtle half.
 *
 * `docs/highlight-tags.md` is the canonical table and `test/highlight.test.ts`
 * asserts this against it, so a consumer can keep one `HighlightStyle` for all
 * three languages. Two conventions are worth knowing:
 *
 *  - an IRI and a prefixed name are tagged differently (`url` / `namespace`)
 *    but denote the same kind of thing, so a style is free to colour them the
 *    same — which is what the reference style does;
 *  - a datatype IRI is tagged `typeName` rather than `url`, because it
 *    qualifies the literal rather than being a term the document is about. The
 *    parent-path rules below are more specific than the bare token rules, so
 *    they win inside `Datatype`.
 */
export const turtleHighlighting: NodePropSource = styleTags({
  Comment: t.comment,

  'AtPrefix AtBase AtVersion KwPrefix KwBase KwGraph KwVersion KeywordA': t.keyword,

  IRIRef: t.url,
  'PNameNS PNameLN': t.namespace,

  'BlankNodeLabel Anon': t.propertyName,

  'String VersionSpecifier': t.string,
  'Integer Decimal Double': t.number,
  'True False': t.bool,

  LangDir: t.annotation,
  'Datatype/IRIRef Datatype/PrefixedName/PNameNS Datatype/PrefixedName/PNameLN': t.typeName,
  'Datatype/"^^"': t.typeName,

  '"<<" ">>" "<<(" ")>>" "{|" "|}"': t.brace,
  '"{" "}"': t.brace,
  '"[" "]"': t.squareBracket,
  '"(" ")"': t.paren,

  '"~"': t.operator,

  '";" ","': t.separator,
  '"."': t.punctuation,
});
