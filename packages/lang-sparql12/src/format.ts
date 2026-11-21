import type { SyntaxNode } from '@lezer/common';
import type { LRParser } from '@lezer/lr';
import { parser } from './sparql.grammar';
import { formatTree } from './layout';
import type { FormatOptions, FormatResult, LayoutRules, Token } from './layout';

export type { FormatChange, FormatError, FormatOptions, FormatResult, LayoutRules, Space, Token } from './layout';

export interface SparqlFormatOptions extends FormatOptions {
  /** Parse with the `lateral` dialect, which accepts `LATERAL { … }`. */
  lateral?: boolean;
}

/** Nodes that start on a new line: clauses, update operations and the items of a group. */
const LINE_STARTS = new Set([
  'BaseDecl', 'PrefixDecl', 'VersionDecl',
  'SelectClause', 'ConstructQuery', 'DescribeQuery', 'AskQuery', 'DatasetClause',
  'GroupClause', 'HavingClause', 'OrderClause', 'LimitClause', 'OffsetClause', 'ValuesClause',
  'Load', 'Clear', 'Drop', 'Create', 'Add', 'Move', 'Copy',
  'InsertData', 'DeleteData', 'DeleteWhere', 'Modify', 'DeleteClause', 'InsertClause', 'UsingClause',
  'TriplesSameSubjectPath', 'TriplesSameSubject', 'QuadsNotTriples',
  'OptionalGraphPattern', 'MinusGraphPattern', 'GraphGraphPattern', 'ServiceGraphPattern',
  'LateralGraphPattern', 'GroupOrUnionGraphPattern', 'Filter', 'Bind', 'InlineData',
  // SRL
  'Rule', 'SrlDataBlock', 'Negation', 'Assignment', 'GroupAggregate', 'TuplePattern', 'TupleTemplate',
]);

/** A `WHERE` that is a clause of its own, not the start of a `WhereClause`. */
const WHERE_PARENTS = new Set(['ConstructQuery', 'Modify', 'Rule']);

/** `{ }` blocks whose content always goes on its own lines. */
const BRACE_BLOCKS = new Set([
  'GroupGraphPattern', 'QuadPattern', 'QuadData', 'ConstructTemplate', 'QuadsNotTriples', 'ConstructQuery',
  'HeadTemplate', 'BodyPattern', 'GroupPattern', 'DataTemplate',
]);

/** Nodes whose `(` follows a function name or keyword with no space: `STR(?x)`, `BIND(…)`. */
const CALLS = new Set([
  'BuiltInCall', 'Aggregate', 'ArgList', 'Bind', 'TuplePattern', 'TupleTemplate', 'Assignment', 'AggregationFunction',
]);

const COLLECTIONS = new Set(['Collection', 'CollectionPath']);
const PATH_OPERATORS = new Set(['PathSequence', 'PathAlternative', 'PathNegatedPropertySet']);
const VERBS = ['Verb', 'VerbPath', 'VerbSimple'];

/** Whether `leaf` is the first token of a node called one of `names`. */
function starts(leaf: Token, names: string[]): boolean {
  for (let n: Token | null = leaf; n && n.from === leaf.from; n = n.parent) if (names.includes(n.name)) return true;
  return false;
}

/** The rows of a `VALUES (?a ?b) { … }` block. */
function rows(data: SyntaxNode): number {
  const brace = data.getChild('{');
  if (!brace) return 0;
  let count = 0;
  for (let c = brace.nextSibling; c; c = c.nextSibling) if (c.name === '(' || c.name === 'Nil') count++;
  return count;
}

/** Whether a `(` or `()` directly follows the name it applies to. */
function isCall(paren: Token, prev: Token): boolean {
  const parent = paren.parent;
  if (!parent) return false;
  if (CALLS.has(parent.name)) return true;
  // CONCAT(…) and COALESCE(…), but not `?x IN (…)`.
  if (parent.name === 'ExpressionList') return prev.name !== 'KwIN';
  // FILTER(…) and DESC(…).
  if (parent.name === 'BrackettedExpression') {
    const outer = parent.parent;
    return outer?.name === 'OrderCondition' || (outer?.name === 'Constraint' && outer.parent?.name === 'Filter');
  }
  return false;
}

/** The layout rules for SPARQL and for SRL, which is the same grammar entered at `SrlUnit`. */
export const sparqlLayout: LayoutRules = {
  startsLine(node) {
    if (LINE_STARTS.has(node.name)) return true;
    // A `WhereClause` is a node, never an anonymous token.
    if (node.name === 'WhereClause') return (node as SyntaxNode).firstChild?.name === 'KwWHERE';
    if (node.name === 'KwWHERE') return WHERE_PARENTS.has(node.parent?.name ?? '');
    return false;
  },

  between(prev, next) {
    const prevParent = prev.parent?.name ?? '';
    const nextParent = next.parent?.name ?? '';

    if (prev.name === '.') return 'line';
    if (prev.name === ';') {
      if (prevParent === 'Update' || prevParent === 'updateTail') return 'line';
      if (starts(next, VERBS)) return 'line';
    }
    if (prev.name === ',' && (prevParent === 'ObjectList' || prevParent === 'ObjectListPath')) return 'line';
    if (next.name === ';' && nextParent === 'Aggregate') return 'none';
    if (next.name === ',') return 'none';

    // The rows of a VALUES block with more than one row.
    if ((next.name === '(' || next.name === 'Nil') && nextParent === 'InlineDataFull' && next.parent) {
      const brace = next.parent.getChild('{');
      if (brace && next.from > brace.from && rows(next.parent) > 1) return 'line';
    }

    if ((next.name === '(' || next.name === 'Nil') && isCall(next, prev)) return 'none';
    if (prev.name === '(' && !COLLECTIONS.has(prevParent)) return 'none';
    if (next.name === ')' && !COLLECTIONS.has(nextParent)) return 'none';

    if (next.name === '^^' || prev.name === '^^' || next.name === 'LangDir') return 'none';
    if (prev.name === '~' && prev.parent && next.from < prev.parent.to) return 'none';

    // Property paths: ex:p/ex:q, ex:p|ex:q, ^ex:p, ex:p*, !ex:p.
    if ((prev.name === '/' || prev.name === '|') && PATH_OPERATORS.has(prevParent)) return 'none';
    if ((next.name === '/' || next.name === '|') && PATH_OPERATORS.has(nextParent)) return 'none';
    if (prev.name === '^' || nextParent === 'PathMod' || prev.name === 'NotOp') return 'none';

    // A unary sign. `- 1` stays apart, because `-1` is a different token.
    if (prev.name === 'ArithOp' && prevParent === 'UnaryExpression') {
      const first = next.from < next.to ? next.name : '';
      if (first && !/^(Integer|Decimal|Double)/.test(first)) return 'none';
    }
    return undefined;
  },

  block(opener) {
    const parent = opener.parent;
    if (!parent) return null;
    if (opener.name === '{' && BRACE_BLOCKS.has(parent.name)) return 'always';
    if (opener.name === '{' && parent.name === 'InlineDataFull') return rows(parent) > 1 ? 'always' : null;
    if (opener.name === '[' && (parent.name === 'BlankNodePropertyList' || parent.name === 'BlankNodePropertyListPath'))
      return 'auto';
    if (opener.name === '{|' && (parent.name === 'AnnotationBlock' || parent.name === 'AnnotationBlockPath')) return 'auto';
    return null;
  },

  isList: (node) =>
    node.name === 'PropertyListNotEmpty' ||
    node.name === 'PropertyListPathNotEmpty' ||
    node.name === 'ObjectList' ||
    node.name === 'ObjectListPath',
};

/**
 * A formatter for any configuration of the SPARQL grammar. `formatSparql` is
 * this over `SparqlUnit`, and `@kurrawongai/codemirror-lang-srl` uses it over
 * `SrlUnit`.
 */
export function sparqlFormatter(configured: LRParser): (text: string, options?: FormatOptions) => FormatResult {
  return (text, options = {}) => formatTree(configured, sparqlLayout, text, options);
}

const plain = sparqlFormatter(parser.configure({ top: 'SparqlUnit' }));
const lateral = sparqlFormatter(parser.configure({ top: 'SparqlUnit', dialect: 'lateral' }));

/**
 * Lay out a SPARQL query or update by changing only the whitespace between
 * tokens. Comments, prefix order and the text of every token are kept, so
 * `LIMIT 0001` and `VALUES ?x { UNDEF }` come back as written.
 *
 * Each prologue declaration, clause and update operation starts a line, each
 * `{ }` group indents one level, and triple patterns follow the Turtle layout.
 * Expressions stay on one line, with their spacing normalised.
 *
 * A document with a parse error comes back unchanged, with `error` set to the
 * first error.
 */
export function formatSparql(text: string, options: SparqlFormatOptions = {}): FormatResult {
  return (options.lateral ? lateral : plain)(text, options);
}
