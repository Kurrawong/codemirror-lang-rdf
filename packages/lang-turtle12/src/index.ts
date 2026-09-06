import type { SyntaxNode } from '@lezer/common';
import type { EditorState } from '@codemirror/state';
import {
  LRLanguage,
  LanguageSupport,
  delimitedIndent,
  foldInside,
  foldNodeProp,
  indentNodeProp,
  syntaxTree,
} from '@codemirror/language';
import type { LRParser } from '@lezer/lr';
import { parser as rawParser } from './turtle.grammar';
import { turtleHighlighting } from './highlight';
import { turtleCompletionSource } from './complete';
import type { CompletionOptions } from './complete';

export type { CompletionOptions, PrefixMap, PrefixSource } from './complete';
export { documentPrefixes, knownPrefixes, turtleCompletionSource } from './complete';
export { turtleHighlighting } from './highlight';

/** The unconfigured grammar, for callers that want their own `top` or props. */
export const parser: LRParser = rawParser;

/**
 * Fold a whole statement from the end of its first line.
 *
 * This is the one fold in Turtle with no brackets around it: a subject with a
 * long `;` list is the common shape a reader wants collapsed, and the structure
 * that shape has is a statement, not a delimiter.
 *
 * It stands aside when a bracket opens on the same line. Folding
 * `ex:s ex:p [` at the statement level would hide the `] .` as well, leaving
 * what is left looking unterminated; the bracket's own fold — which CodeMirror
 * would otherwise never reach, since the statement node encloses it — reads
 * correctly.
 */
const statementFold = (node: SyntaxNode, state: EditorState) => {
  const firstLineEnd = state.doc.lineAt(node.from).to;
  if (node.to <= firstLineEnd) return null;
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(firstLineEnd, -1); n; n = n.parent) {
    if (n.from < node.from) break;
    if (n.type.prop(foldNodeProp) && n.from <= firstLineEnd && n.to > firstLineEnd && n.type !== node.type) return null;
  }
  return { from: firstLineEnd, to: node.to };
};

/** Highlighting, folding and indentation, shared by all four dialects. */
const props = [
  turtleHighlighting,
  indentNodeProp.add({
    BlankNodePropertyList: delimitedIndent({ closing: ']' }),
    Collection: delimitedIndent({ closing: ')' }),
    WrappedGraph: delimitedIndent({ closing: '}' }),
    AnnotationBlock: delimitedIndent({ closing: '|}' }),
    TripleTerm: delimitedIndent({ closing: ')>>' }),
    ReifiedTriple: delimitedIndent({ closing: '>>' }),
  }),
  foldNodeProp.add({
    BlankNodePropertyList: foldInside,
    Collection: foldInside,
    WrappedGraph: foldInside,
    AnnotationBlock: foldInside,
    'Triples Triples2 TriplesOrGraph': statementFold,
  }),
];

const languageData = {
  commentTokens: { line: '#' },
  closeBrackets: { brackets: ['[', '(', '<', '"', "'"] },
  indentOnInput: /^\s*[\]})]$/,
};

function define(top: string) {
  return LRLanguage.define({
    name: top === 'TurtleDoc' ? 'turtle' : top === 'TrigDoc' ? 'trig' : top === 'NTriplesDoc' ? 'ntriples' : 'nquads',
    parser: rawParser.configure({ top, props }),
    languageData,
  });
}

export const turtleLanguage = define('TurtleDoc');
export const trigLanguage = define('TrigDoc');
export const ntriplesLanguage = define('NTriplesDoc');
export const nquadsLanguage = define('NQuadsDoc');

function support(language: LRLanguage, options: CompletionOptions, dialect: 'turtle' | 'trig') {
  return new LanguageSupport(language, [
    language.data.of({ autocomplete: turtleCompletionSource(options, dialect) }),
  ]);
}

/** RDF 1.2 Turtle. */
export function turtle(options: CompletionOptions = {}): LanguageSupport {
  return support(turtleLanguage, options, 'turtle');
}

/** RDF 1.2 TriG. */
export function trig(options: CompletionOptions = {}): LanguageSupport {
  return support(trigLanguage, options, 'trig');
}

/**
 * RDF 1.2 N-Triples.
 *
 * A strict subset with its own entry point rather than Turtle in a lenient
 * mood: a prefixed name or a `;` list in an N-Triples document is an error, and
 * an editor that colours it as valid is lying about the file it will write.
 */
export function ntriples(): LanguageSupport {
  return new LanguageSupport(ntriplesLanguage);
}

/** RDF 1.2 N-Quads. */
export function nquads(): LanguageSupport {
  return new LanguageSupport(nquadsLanguage);
}
