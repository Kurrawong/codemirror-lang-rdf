import { indentUnit, language } from '@codemirror/language';
import type { StateCommand } from '@codemirror/state';
import { parser } from './turtle.grammar';
import { formatTree } from './layout';
import type { FormatOptions, FormatResult, LayoutRules, Token } from './layout';

export type { FormatChange, FormatError, FormatOptions, FormatResult } from './layout';

export interface TurtleFormatOptions extends FormatOptions {
  /** Which grammar to parse with. Defaults to `turtle`. */
  dialect?: 'turtle' | 'trig';
}

/** The statements of a document and of a TriG graph block. */
const STATEMENTS = new Set(['Directive', 'Triples', 'TriplesOrGraph', 'GraphStatement', 'Triples2']);

/** Whether `leaf` is the first token of a node called `name`. */
function starts(leaf: Token, name: string): boolean {
  for (let n: Token | null = leaf; n && n.from === leaf.from; n = n.parent) if (n.name === name) return true;
  return false;
}

export const turtleLayout: LayoutRules = {
  startsLine: (node) =>
    STATEMENTS.has(node.name) || (node.name === 'WrappedGraph' && node.parent?.name === 'TrigDoc'),

  between(prev, next) {
    if (prev.name === '.') return 'line';
    if (prev.name === ';' && starts(next, 'Verb')) return 'line';
    if (prev.name === ',' && prev.parent?.name === 'ObjectList') return 'line';
    if (next.name === ',' || next.name === '^^' || next.name === 'LangDir' || prev.name === '^^') return 'none';
    if (prev.name === '~' && prev.parent && next.from < prev.parent.to) return 'none';
    return undefined;
  },

  block(opener) {
    const parent = opener.parent?.name;
    if (opener.name === '{' && parent === 'WrappedGraph') return 'always';
    if (opener.name === '[' && parent === 'BlankNodePropertyList') return 'auto';
    if (opener.name === '{|' && parent === 'AnnotationBlock') return 'auto';
    return null;
  },

  isList: (node) => node.name === 'PredicateObjectList' || node.name === 'ObjectList',
};

const turtleParser = parser.configure({ top: 'TurtleDoc' });
const trigParser = parser.configure({ top: 'TrigDoc' });

/**
 * Lay out a Turtle or TriG document by changing only the whitespace between
 * tokens. Comments, prefix order and the text of every token are kept.
 *
 * Each directive and each subject goes on its own line, `;` and `,` lists
 * break and indent, `[ ]` and `{| |}` break when their content has a list or
 * a comment in it, and a TriG graph block indents its statements.
 *
 * A document with a parse error comes back unchanged, with `error` set to the
 * first error.
 */
export function formatTurtle(text: string, options: TurtleFormatOptions = {}): FormatResult {
  return formatTree(options.dialect === 'trig' ? trigParser : turtleParser, turtleLayout, text, options);
}

/**
 * Format the whole document in one transaction, with the indent unit of the
 * editor. Returns `false`, and changes nothing, when the editor's language is
 * not Turtle or TriG or when the document has a parse error.
 */
export const formatTurtleDocument: StateCommand = ({ state, dispatch }) => {
  const name = state.facet(language)?.name;
  if (name !== 'turtle' && name !== 'trig') return false;
  const result = formatTurtle(state.doc.toString(), { dialect: name, indent: state.facet(indentUnit) });
  if (result.error) return false;
  if (result.changes.length) dispatch(state.update({ changes: result.changes, userEvent: 'format' }));
  return true;
};
