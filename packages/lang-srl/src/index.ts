import { LRLanguage, LanguageSupport, syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';
import type { LRParser } from '@lezer/lr';
import { parser as sparqlParser, sparqlProps, sparqlCompletionSource } from 'codemirror-lang-sparql12';
import type { CompletionOptions } from 'codemirror-lang-sparql12';

export type { CompletionOptions, PrefixMap, PrefixSource } from 'codemirror-lang-sparql12';
export { documentPrefixes, documentVariables, knownPrefixes, srlKeywords } from 'codemirror-lang-sparql12';

export interface SrlOptions extends CompletionOptions {
  /**
   * Whether the rule-tuples extension is in play.
   *
   * This does **not** change what parses. `TUPLE( … )` is always in the
   * grammar, because a grammar with two shapes is a grammar that can disagree
   * with itself, and because an editor that simply stops colouring `TUPLE`
   * tells the author nothing about why. What the flag changes is the advice:
   * with `tuples: false` the completion list leaves `TUPLE` out, and
   * `tupleRanges()` hands an application the spans to mark as diagnostics —
   * matching the gate on `parseRuleSet(text, { tuples })`.
   *
   * Defaults to `true`.
   */
  tuples?: boolean;
}

/**
 * The SRL parser: the SPARQL 1.2 grammar entered at `SrlUnit`.
 *
 * There is no second grammar. SRL's productions live in `sparql.grammar`
 * alongside SPARQL's and share every rule below the rule body, so the two
 * languages cannot drift apart about what a term is — a `<<( … )>>` in a rule
 * body is the same node as a `<<( … )>>` in a query.
 */
export const parser: LRParser = sparqlParser.configure({ top: 'SrlUnit' });

export const srlLanguage = LRLanguage.define({
  name: 'srl',
  parser: sparqlParser.configure({ top: 'SrlUnit', props: sparqlProps }),
  languageData: {
    commentTokens: { line: '#' },
    closeBrackets: { brackets: ['{', '[', '(', '<', '"', "'"] },
    indentOnInput: /^\s*[\]})]$/,
  },
});

/**
 * The spans of every `TUPLE( … )` in the document.
 *
 * For an application that has the extension switched off: these are the ranges
 * to raise a diagnostic on. The nodes are named for their position, so a
 * caller can tell a tuple in a rule head from one in a rule body without
 * re-reading the text.
 */
export interface TupleRange {
  from: number;
  to: number;
  /** `TupleTemplate` in a rule head, `TuplePattern` in a rule body. */
  kind: 'TupleTemplate' | 'TuplePattern';
}

export function tupleRanges(state: EditorState): TupleRange[] {
  const found: TupleRange[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'TupleTemplate' || node.name === 'TuplePattern')
        found.push({ from: node.from, to: node.to, kind: node.name });
    },
  });
  return found;
}

/** The spans of every `Rule` in the document, in order — one per rule block. */
export function ruleRanges(state: EditorState): { from: number; to: number }[] {
  const found: { from: number; to: number }[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'Rule') found.push({ from: node.from, to: node.to });
    },
  });
  return found;
}

/** The spans of every ground `DATA { … }` block in the document, in order. */
export function dataBlockRanges(state: EditorState): { from: number; to: number }[] {
  const found: { from: number; to: number }[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'SrlDataBlock') found.push({ from: node.from, to: node.to });
    },
  });
  return found;
}

/**
 * Every variable that appears inside a ground `DATA { … }` block.
 *
 * A `DATA` block is ground triples by definition, so a variable in one is an
 * error — but not a *syntactic* one: expressing it in the grammar would mean a
 * third parallel triples hierarchy (ground, alongside path and non-path) for
 * one rule, and the parse error it produced would point at the block rather
 * than at the variable.
 *
 * So the grammar accepts it and this hands back the exact spans, which is what
 * a linter wants: `DATA { :s :p ?o }` should underline `?o` and say why, not
 * mark the whole block red. The conformance suite's four `syntax-data-bad`
 * entries for this are listed in `test/corpus/expected-fail.json` with the
 * same reasoning.
 */
export function variablesInDataBlocks(state: EditorState): { from: number; to: number; name: string }[] {
  const found: { from: number; to: number; name: string }[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'SrlDataBlock') return;
      node.node.cursor().iterate((inner) => {
        if (inner.name === 'Var1' || inner.name === 'Var2')
          found.push({ from: inner.from, to: inner.to, name: state.sliceDoc(inner.from, inner.to) });
      });
      return false;
    },
  });
  return found;
}

/** SRL (the SPARQL Rule Language). */
export function srl(options: SrlOptions = {}): LanguageSupport {
  const source = sparqlCompletionSource({ ...options, dialect: 'srl' });
  const tuples = options.tuples ?? true;
  return new LanguageSupport(srlLanguage, [
    srlLanguage.data.of({
      autocomplete: tuples
        ? source
        : (context: Parameters<typeof source>[0]) => {
            const result = source(context);
            if (!result) return null;
            return { ...result, options: result.options.filter((o) => o.label !== 'TUPLE') };
          },
    }),
  ]);
}
