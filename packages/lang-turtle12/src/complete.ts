import { syntaxTree } from '@codemirror/language';
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import type { EditorState } from '@codemirror/state';

/** A prefix label (without the colon) mapped to the IRI it expands to. */
export type PrefixMap = Record<string, string>;

/** Where `turtle()` and friends may look for prefixes beyond the document. */
export type PrefixSource = PrefixMap | ((state: EditorState) => PrefixMap);

export interface CompletionOptions {
  /**
   * Prefixes the editor should offer even when the document has not declared
   * them — an application's own prefix manager, typically. Document
   * declarations win on conflict, because what the document says is what the
   * document means.
   */
  prefixSource?: PrefixSource;
}

const DIRECTIVES = ['@prefix', '@base', 'PREFIX', 'BASE'];
const TRIG_DIRECTIVES = [...DIRECTIVES, 'GRAPH'];
const TERM_KEYWORDS = ['a', 'true', 'false'];

/** Nodes whose interior is text, not syntax: no completion belongs there. */
const INERT = new Set(['Comment', 'String', 'VersionSpecifier', 'IRIRef']);

/**
 * The prefixes declared by the document itself, read from the syntax tree.
 *
 * Both spellings are read — `@prefix ex: <…>` and `PREFIX ex: <…>` — because a
 * document may mix them, and a reader completing `ex:` does not care which one
 * declared it.
 */
export function documentPrefixes(state: EditorState): PrefixMap {
  const prefixes: PrefixMap = {};
  const tree = syntaxTree(state);
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'PrefixID' && node.name !== 'SparqlPrefix') return;
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

function resolveSource(source: PrefixSource | undefined, state: EditorState): PrefixMap {
  if (!source) return {};
  return typeof source === 'function' ? source(state) : source;
}

/** Every prefix the editor knows about: the external source, overlaid by the document's. */
export function knownPrefixes(state: EditorState, options: CompletionOptions = {}): PrefixMap {
  return { ...resolveSource(options.prefixSource, state), ...documentPrefixes(state) };
}

function prefixCompletions(state: EditorState, options: CompletionOptions): Completion[] {
  const prefixes = knownPrefixes(state, options);
  return Object.entries(prefixes).map(([label, iri]) => ({
    label: `${label}:`,
    type: 'namespace',
    detail: iri || undefined,
  }));
}

function keywordCompletions(words: readonly string[]): Completion[] {
  return words.map((label) => ({ label, type: 'keyword' }));
}

/**
 * Is the cursor inside a literal or IRI that has not been closed yet?
 *
 * A half-typed `"some tex` or `<http://ex` never reaches a `String` or
 * `IRIRef` node — it is error debris, and the error node covers only the last
 * word — so the node name cannot answer this. Scanning the line up to the
 * cursor can, and it is the state a reader is in while typing one.
 *
 * Two details earn their place. `<<` is not an IRI, so it does not open one,
 * which keeps completion alive inside a half-typed reified triple. And an IRI
 * cannot contain a space, so whitespace closes the scan rather than
 * suppressing completion for the rest of the line.
 *
 * The scan is line-local, so an unterminated *long* string (`"""…`) spanning
 * lines is not detected past its first line. Terminated ones are, through the
 * `String` node above.
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

/**
 * Completion for Turtle-family documents.
 *
 * Deliberately context-light: it offers directives, the three term keywords and
 * the document's prefixes wherever a word is being typed, rather than trying to
 * work out whether the cursor is in a subject or an object position. In an
 * error-tolerant tree a half-typed statement usually has no reliable position
 * to read, and a wrong context is worse than a slightly long list.
 */
export function turtleCompletionSource(
  options: CompletionOptions = {},
  dialect: 'turtle' | 'trig' = 'turtle'
) {
  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[@A-Za-z_][\w.-]*:?/);
    if (!word && !context.explicit) return null;
    const from = word ? word.from : context.pos;

    const node = syntaxTree(context.state).resolveInner(context.pos, -1);
    if (INERT.has(node.name)) return null;
    if (inUnterminatedTerm(context.state, context.pos)) return null;

    const directives = dialect === 'trig' ? TRIG_DIRECTIVES : DIRECTIVES;
    return {
      from,
      options: [
        ...keywordCompletions(directives),
        ...keywordCompletions(TERM_KEYWORDS),
        ...prefixCompletions(context.state, options),
      ],
      validFor: /^[@A-Za-z_][\w.-]*:?$/,
    };
  };
}
