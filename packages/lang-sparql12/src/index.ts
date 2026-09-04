import {
  LRLanguage,
  LanguageSupport,
  delimitedIndent,
  foldInside,
  foldNodeProp,
  indentNodeProp,
} from '@codemirror/language';
import type { LRParser } from '@lezer/lr';
import type { SyntaxNode } from '@lezer/common';
import { parser as rawParser } from './sparql.grammar';
import { sparqlHighlighting } from './highlight';
import { sparqlCompletionSource } from './complete';
import type { CompletionOptions } from './complete';

export type { CompletionOptions, CompletionSourceOptions, PrefixMap, PrefixSource } from './complete';
export {
  documentPrefixes,
  documentVariables,
  knownPrefixes,
  sparqlCompletionSource,
  sparqlFunctions,
  sparqlKeywords,
  srlKeywords,
} from './complete';
export { sparqlHighlighting } from './highlight';
export { KEYWORDS, KEYWORD_NODE_NAMES } from './keywords';

/**
 * The unconfigured grammar.
 *
 * `codemirror-lang-srl` is `parser.configure({ top: 'SrlUnit' })` on this, and
 * that is the whole reason it is exported: SPARQL and SRL then cannot disagree
 * about what a term is, because there is only one grammar to disagree with.
 */
export const parser: LRParser = rawParser;

/** Fold the interior of the `{ … }` sitting inside a node rather than around it. */
function foldBetweenBraces(node: SyntaxNode) {
  const open = node.getChild('{');
  const close = node.getChild('}');
  if (!open || !close || close.from <= open.to) return null;
  return { from: open.to, to: close.from };
}

/**
 * Folding, indentation and highlighting, shared by both entry points.
 *
 * `VALUES` blocks fold through `DataBlock`; every other fold is a delimiter,
 * because in SPARQL — unlike Turtle — the structure a reader wants to collapse
 * always has braces or parentheses around it.
 */
export const sparqlProps = [
  sparqlHighlighting,
  indentNodeProp.add({
    'GroupGraphPattern QuadPattern QuadData ConstructTemplate HeadTemplate BodyPattern DataTemplate':
      delimitedIndent({ closing: '}' }),
    'BlankNodePropertyList BlankNodePropertyListPath': delimitedIndent({ closing: ']' }),
    'Collection CollectionPath BrackettedExpression ArgList ExpressionList':
      delimitedIndent({ closing: ')' }),
    AnnotationBlock: delimitedIndent({ closing: '|}' }),
    AnnotationBlockPath: delimitedIndent({ closing: '|}' }),
    TripleTerm: delimitedIndent({ closing: ')>>' }),
    ReifiedTriple: delimitedIndent({ closing: '>>' }),
    'InlineDataOneVar InlineDataFull': delimitedIndent({ closing: '}' }),
  }),
  foldNodeProp.add({
    'GroupGraphPattern QuadPattern QuadData ConstructTemplate': foldInside,
    'BlankNodePropertyList BlankNodePropertyListPath': foldInside,
    'Collection CollectionPath BrackettedExpression ArgList ExpressionList': foldInside,
    'AnnotationBlock AnnotationBlockPath': foldInside,
    // A VALUES block's braces are in the middle of the node, not at its ends,
    // so `foldInside` here would fold from after the variable list — dragging
    // the opening brace into the folded range.
    'InlineDataOneVar InlineDataFull': foldBetweenBraces,
    // SRL's own blocks, so a rule and a ground-data block each fold as a unit.
    'HeadTemplate BodyPattern DataTemplate': foldInside,
  }),
];

const languageData = {
  commentTokens: { line: '#' },
  closeBrackets: { brackets: ['{', '[', '(', '<', '"', "'"] },
  indentOnInput: /^\s*[\]})]$/,
};

export const sparqlLanguage = LRLanguage.define({
  name: 'sparql',
  parser: rawParser.configure({ top: 'SparqlUnit', props: sparqlProps }),
  languageData,
});

/** SPARQL 1.2, query and update. */
export function sparql(options: CompletionOptions = {}): LanguageSupport {
  return new LanguageSupport(sparqlLanguage, [
    sparqlLanguage.data.of({ autocomplete: sparqlCompletionSource({ ...options, dialect: 'sparql' }) }),
  ]);
}
