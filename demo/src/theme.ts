import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { tags as t } from '@lezer/highlight';

/**
 * One `HighlightStyle` for all six languages, exactly as `docs/highlight-tags.md`
 * says an application can keep.
 *
 * The colours are `var(--…)` references rather than resolved values. A
 * `HighlightStyle` rule is emitted as an ordinary CSS declaration, so a custom
 * property in it is resolved by the browser at paint time against whatever
 * `:root` says *now* — which makes one static style theme-aware with no
 * reactivity and no re-created editors. CodeMirror emits highlight styles under
 * generated class names (`.ͼ1`, `.ͼ2`, …) that no CSS selector can reach, so
 * this indirection is the supported way to do it.
 */
export const rdfHighlightStyle = HighlightStyle.define([
  { tag: t.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },

  { tag: t.keyword, color: 'var(--syntax-keyword)', fontWeight: '600' },

  // An IRI and a prefixed name denote the same kind of thing, so they take the
  // same colour even though the grammars tag them differently.
  { tag: [t.url, t.namespace], color: 'var(--rdf-iri)' },

  { tag: [t.string, t.number, t.bool], color: 'var(--rdf-literal)' },

  // The de-emphasised qualifiers hanging off a term.
  { tag: [t.typeName, t.annotation], color: 'var(--rdf-qualifier)' },

  { tag: t.variableName, color: 'var(--rdf-var)' },
  { tag: t.propertyName, color: 'var(--rdf-bnode)' },

  {
    tag: [t.brace, t.squareBracket, t.paren, t.separator, t.punctuation, t.operator],
    color: 'var(--syntax-punct)',
  },

  /*
   * The RDF 1.2 term brackets. A style need not say anything about these — each
   * falls back to the ordinary bracket rule above — so they are here to show
   * what becomes possible once it does, and the "Conventional" palette proves
   * the fallback by setting all three to the punctuation colour.
   */
  { tag: t.special(t.angleBracket), color: 'var(--rdf-reified)' },
  { tag: t.special(t.paren), color: 'var(--rdf-tripleterm)' },
  { tag: t.special(t.brace), color: 'var(--rdf-annotation)' },
  { tag: t.special(t.operator), color: 'var(--rdf-reifier)' },

  { tag: t.invalid, color: 'var(--danger)' },
]);

/** Editor chrome, driven from the same tokens as the page. */
const chrome = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    color: 'var(--fg)',
    backgroundColor: 'var(--editor-bg)',
  },
  '.cm-content': {
    fontFamily: 'var(--mono)',
    padding: '12px 0',
    caretColor: 'var(--accent)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--fg-faint)',
    border: 'none',
    borderRight: '1px solid var(--rule)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active)', color: 'var(--fg-muted)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--editor-selection)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--editor-active)',
    border: '1px solid var(--rule)',
    borderRadius: '3px',
    color: 'var(--fg-muted)',
    padding: '0 6px',
    margin: '0 2px',
  },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--editor-bracket)',
    outline: '1px solid var(--rule-strong)',
  },
  '.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--danger) 22%, transparent)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--panel-bg)',
    border: '1px solid var(--rule)',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--mono)', maxHeight: '16em' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-fg)',
  },
  '.cm-completionIcon': { opacity: 0.6 },
  '.cm-completionDetail': { color: 'var(--fg-faint)', fontStyle: 'normal', marginLeft: '1em' },
});

export const demoTheme: Extension = [chrome, syntaxHighlighting(rdfHighlightStyle)];
