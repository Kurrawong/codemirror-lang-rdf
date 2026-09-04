import { syntaxTree } from '@codemirror/language';
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { EditorState } from '@codemirror/state';

/** A prefix label (without the colon) mapped to the IRI it expands to. */
export type PrefixMap = Record<string, string>;

/** Where the editor may look for prefixes beyond the document's own declarations. */
export type PrefixSource = PrefixMap | ((state: EditorState) => PrefixMap);

export interface CompletionOptions {
  /**
   * Prefixes to offer even when the document has not declared them — an
   * application's prefix manager, typically. Document declarations win on
   * conflict, because what the document says is what the document means.
   */
  prefixSource?: PrefixSource;
}

/*
 * The keyword lists are the canonical *spellings*, which the grammar's term
 * names cannot supply: the grammar is case-insensitive and stores everything
 * upper-cased, but a completion that inserts `ISTRIPLE` where the spec writes
 * `isTRIPLE` reads as a mistake. Splitting them by kind is what lets the
 * completion list say `keyword` or `function` in its type column.
 */
const QUERY_KEYWORDS = [
  'BASE', 'PREFIX', 'VERSION', 'SELECT', 'DISTINCT', 'REDUCED', 'AS', 'CONSTRUCT',
  'WHERE', 'DESCRIBE', 'ASK', 'FROM', 'NAMED', 'GROUP BY', 'HAVING', 'ORDER BY',
  'ASC', 'DESC', 'LIMIT', 'OFFSET', 'VALUES', 'UNDEF', 'OPTIONAL', 'GRAPH',
  'SERVICE', 'SILENT', 'BIND', 'MINUS', 'UNION', 'FILTER', 'NOT EXISTS', 'EXISTS',
  'IN', 'NOT IN', 'a', 'true', 'false',
];

const UPDATE_KEYWORDS = [
  'LOAD', 'INTO', 'CLEAR', 'DROP', 'CREATE', 'ADD', 'MOVE', 'COPY', 'TO',
  'INSERT DATA', 'DELETE DATA', 'DELETE WHERE', 'INSERT', 'DELETE', 'WITH',
  'USING', 'DEFAULT', 'ALL',
];

const FUNCTIONS = [
  'STR', 'LANG', 'LANGMATCHES', 'DATATYPE', 'BOUND', 'IRI', 'URI', 'BNODE', 'RAND',
  'ABS', 'CEIL', 'FLOOR', 'ROUND', 'CONCAT', 'SUBSTR', 'STRLEN', 'REPLACE',
  'UCASE', 'LCASE', 'ENCODE_FOR_URI', 'CONTAINS', 'STRSTARTS', 'STRENDS',
  'STRBEFORE', 'STRAFTER', 'YEAR', 'MONTH', 'DAY', 'HOURS', 'MINUTES', 'SECONDS',
  'TIMEZONE', 'TZ', 'NOW', 'UUID', 'STRUUID', 'MD5', 'SHA1', 'SHA256', 'SHA384',
  'SHA512', 'COALESCE', 'IF', 'STRLANG', 'STRDT', 'sameTerm', 'isIRI', 'isURI',
  'isBLANK', 'isLITERAL', 'isNUMERIC', 'REGEX',
  // SPARQL 1.2
  'TRIPLE', 'isTRIPLE', 'SUBJECT', 'PREDICATE', 'OBJECT', 'LANGDIR', 'hasLANG',
  'hasLANGDIR', 'STRLANGDIR',
];

const AGGREGATES = ['COUNT', 'SUM', 'MIN', 'MAX', 'AVG', 'SAMPLE', 'GROUP_CONCAT', 'SEPARATOR'];

/** SRL adds these to the SPARQL list; `DATA`, `NOT`, `WHERE` and `FILTER` it already had. */
const SRL_KEYWORDS = ['RULE', 'WHERE', 'DATA', 'NOT', 'FILTER', 'SET', 'TUPLE'];

export const sparqlKeywords: readonly string[] = [...QUERY_KEYWORDS, ...UPDATE_KEYWORDS];
export const sparqlFunctions: readonly string[] = [...FUNCTIONS, ...AGGREGATES];
export const srlKeywords: readonly string[] = SRL_KEYWORDS;

/** Nodes whose interior is text, not syntax: no completion belongs there. */
const INERT = new Set(['Comment', 'String', 'VersionSpecifier', 'IRIRef']);

/**
 * The prefixes declared by the document itself, read from the syntax tree.
 *
 * Works the same for a query, an update and an SRL rule set, because all three
 * share the `PrefixDecl` production.
 */
export function documentPrefixes(state: EditorState): PrefixMap {
  const prefixes: PrefixMap = {};
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'PrefixDecl') return;
      let label: string | null = null;
      let iri: string | null = null;
      for (let child = node.node.firstChild; child; child = child.nextSibling) {
        if (child.name === 'PNameNS' && label === null) {
          label = state.sliceDoc(child.from, child.to).slice(0, -1);
        } else if (child.name === 'IRIRef' && iri === null) {
          iri = state.sliceDoc(child.from + 1, child.to - 1);
        }
      }
      if (label !== null) prefixes[label] = iri ?? '';
    },
  });
  return prefixes;
}

/**
 * Every variable the document already mentions, with its sigil.
 *
 * Offering these is the completion that earns its keep most often: a query
 * names the same variable in a pattern, a filter and a projection, and typing
 * it identically three times is where the typos are.
 */
export function documentVariables(state: EditorState): string[] {
  const seen = new Set<string>();
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'Var1' || node.name === 'Var2') seen.add(state.sliceDoc(node.from, node.to));
    },
  });
  return [...seen].sort();
}

function resolveSource(source: PrefixSource | undefined, state: EditorState): PrefixMap {
  if (!source) return {};
  return typeof source === 'function' ? source(state) : source;
}

/** Every prefix the editor knows about: the external source, overlaid by the document's. */
export function knownPrefixes(state: EditorState, options: CompletionOptions = {}): PrefixMap {
  return { ...resolveSource(options.prefixSource, state), ...documentPrefixes(state) };
}

/**
 * Is the cursor inside a literal or IRI that has not been closed yet?
 *
 * A half-typed `"some tex` or `<http://ex` never reaches a `String` or
 * `IRIRef` node — it is error debris, and the error node covers only the last
 * word — so the node name cannot answer this. Scanning the line up to the
 * cursor can.
 *
 * `<<` is not an IRI, so it does not open one, which keeps completion alive
 * inside a half-typed reified triple. An IRI cannot contain a space, so
 * whitespace closes the scan rather than suppressing completion for the rest
 * of the line. The scan is line-local, so an unterminated *long* string
 * spanning lines is not detected past its first line.
 */
function inUnterminatedTerm(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos);
  const text = line.text.slice(0, pos - line.from);
  let quote: string | null = null;
  let angle = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (angle) {
      if (ch === '>' || ch === ' ' || ch === '\t') angle = false;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '<' && text[i + 1] !== '<') {
      angle = true;
    }
  }
  return quote !== null || angle;
}

function label(labels: readonly string[], type: string): Completion[] {
  return labels.map((l) => ({ label: l, type }));
}

export interface CompletionSourceOptions extends CompletionOptions {
  /** Which keyword set to offer. SRL adds its own and drops the update ones. */
  dialect?: 'sparql' | 'srl';
}

/**
 * Completion for SPARQL and SRL.
 *
 * Deliberately context-light on *keywords*: it offers the whole set wherever a
 * word is being typed rather than working out whether the cursor is in a
 * pattern or a projection. In an error-tolerant tree a half-typed clause
 * rarely has a reliable position to read, and a wrong context is worse than a
 * slightly long list — CodeMirror filters by what has been typed anyway.
 *
 * Prefixes and variables are the opposite: they come from the document, so
 * they are always exactly right.
 */
export function sparqlCompletionSource(options: CompletionSourceOptions = {}) {
  const srl = options.dialect === 'srl';
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[?$A-Za-z_][\w.-]*:?/);
    if (!word && !context.explicit) return null;
    const from = word ? word.from : context.pos;

    const node = syntaxTree(context.state).resolveInner(context.pos, -1);
    if (INERT.has(node.name)) return null;
    if (inUnterminatedTerm(context.state, context.pos)) return null;

    const prefixes = knownPrefixes(context.state, options);
    return {
      from,
      options: [
        ...label(srl ? [...QUERY_KEYWORDS, ...SRL_KEYWORDS] : sparqlKeywords, 'keyword'),
        ...label(sparqlFunctions, 'function'),
        ...label(documentVariables(context.state), 'variable'),
        ...Object.entries(prefixes).map(([l, iri]) => ({
          label: `${l}:`,
          type: 'namespace',
          detail: iri || undefined,
        })),
      ],
      validFor: /^[?$A-Za-z_][\w.-]*:?$/,
    };
  };
}
