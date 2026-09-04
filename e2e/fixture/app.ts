/**
 * The end-to-end fixture: real CodeMirror editors, in a real browser.
 *
 * The unit tests drive `EditorState` headlessly, which proves the grammar and
 * the extensions agree. They cannot prove what a reader actually sees — that
 * `SELECT` arrives on screen in the keyword colour, that clicking a fold gutter
 * hides the right lines, that typing brings up the right completion list. Those
 * are properties of the rendered editor, so they are tested here.
 *
 * The highlight style is deliberately a *distinct colour per tag*, not a
 * pleasant theme: a test that asserts a colour needs the colours to be
 * distinguishable, and using the shared tag table as the source of the mapping
 * means this fixture also demonstrates the one-style-for-six-languages claim.
 */
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { HighlightStyle, foldGutter, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, startCompletion } from '@codemirror/autocomplete';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { foldAll, foldCode, unfoldAll } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { nquads, ntriples, trig, turtle } from 'codemirror-lang-turtle12';
import { sparql } from 'codemirror-lang-sparql12';
import { srl } from 'codemirror-lang-srl';

/** One colour per tag from `docs/highlight-tags.md`, all six languages sharing it. */
const COLOURS = {
  comment: 'rgb(1, 1, 1)',
  keyword: 'rgb(2, 2, 2)',
  url: 'rgb(3, 3, 3)',
  namespace: 'rgb(4, 4, 4)',
  variableName: 'rgb(5, 5, 5)',
  propertyName: 'rgb(6, 6, 6)',
  string: 'rgb(7, 7, 7)',
  number: 'rgb(8, 8, 8)',
  bool: 'rgb(9, 9, 9)',
  typeName: 'rgb(10, 10, 10)',
  annotation: 'rgb(11, 11, 11)',
  brace: 'rgb(12, 12, 12)',
  squareBracket: 'rgb(13, 13, 13)',
  paren: 'rgb(14, 14, 14)',
  operator: 'rgb(15, 15, 15)',
  separator: 'rgb(16, 16, 16)',
  punctuation: 'rgb(17, 17, 17)',
} as const;

export type TagName = keyof typeof COLOURS;

const style = HighlightStyle.define(
  (Object.keys(COLOURS) as TagName[]).map((name) => ({
    tag: t[name],
    color: COLOURS[name],
  }))
);

const languages = {
  turtle: () => turtle({ prefixSource: { ext: 'http://external/' } }),
  trig: () => trig(),
  ntriples: () => ntriples(),
  nquads: () => nquads(),
  sparql: () => sparql({ prefixSource: { ext: 'http://external/' } }),
  srl: () => srl({ prefixSource: { ext: 'http://external/' } }),
  'srl-no-tuples': () => srl({ tuples: false }),
} as const;

export type LanguageName = keyof typeof languages;

const views = new Map<string, EditorView>();

/*
 * `window.rdfFixture` is declared once, in `e2e/global.d.ts`, because the spec
 * files are compiled separately from this bundle and both need the shape. A
 * second `declare global` here would be a second source of truth for it.
 */

function viewFor(id: string): EditorView {
  const view = views.get(id);
  if (!view) throw new Error(`no editor mounted as ${id}`);
  return view;
}

window.rdfFixture = {
  colours: COLOURS,

  mount(id, language, doc) {
    views.get(id)?.destroy();
    document.getElementById(id)?.remove();
    const host = document.createElement('div');
    host.id = id;
    host.className = 'editor';
    document.body.append(host);
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc,
        extensions: [
          lineNumbers(),
          foldGutter(),
          syntaxHighlighting(style),
          autocompletion({ activateOnTyping: false }),
          keymap.of([...defaultKeymap, indentWithTab]),
          indentUnit.of('  '),
          // Honours each language's `indentOnInput` language data, which is what
          // makes typing a closing bracket dedent the line.
          indentOnInput(),
          languages[language](),
        ],
      }),
    });
    views.set(id, view);
  },

  tokens(id) {
    const view = viewFor(id);
    const spans = view.contentDOM.querySelectorAll('span');
    return [...spans].map((span) => ({
      text: span.textContent ?? '',
      color: getComputedStyle(span).color,
    }));
  },

  colourOf(id, token) {
    return this.tokens(id).find((s) => s.text === token)?.color ?? null;
  },

  tagOf(id, token) {
    const colour = this.colourOf(id, token);
    if (!colour) return null;
    const found = (Object.keys(COLOURS) as TagName[]).find(
      (name) => COLOURS[name].replace(/\s/g, '') === colour.replace(/\s/g, '')
    );
    return found ?? null;
  },

  visibleText(id) {
    return viewFor(id).contentDOM.textContent ?? '';
  },

  lineCount(id) {
    return viewFor(id).contentDOM.querySelectorAll('.cm-line').length;
  },

  /**
   * The line numbers whose fold gutter shows a "Fold line" marker.
   *
   * Read off the rendered gutters rather than from `foldable()`, so this
   * answers "what can the reader click?" rather than "what would the extension
   * return?". The fold gutter's first element is a zero-height width prototype
   * that always carries a marker, hence the height check; line numbers come
   * from the line-number gutter, which renders in lockstep with it.
   */
  foldGutterMarkers(id) {
    const view = viewFor(id);
    const foldGutter = view.dom.querySelector('.cm-foldGutter');
    const numberGutter = view.dom.querySelector('.cm-lineNumbers');
    if (!foldGutter || !numberGutter) return [];

    const numbersByTop = new Map<number, number>();
    numberGutter.querySelectorAll('.cm-gutterElement').forEach((el) => {
      const rect = el.getBoundingClientRect();
      const number = Number(el.textContent);
      if (rect.height > 0 && Number.isFinite(number)) numbersByTop.set(Math.round(rect.top), number);
    });

    const lines: number[] = [];
    foldGutter.querySelectorAll('.cm-gutterElement').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) return;
      if (!el.querySelector('[title="Fold line"]')) return;
      const number = numbersByTop.get(Math.round(rect.top));
      if (number !== undefined) lines.push(number);
    });
    return [...new Set(lines)].sort((a, b) => a - b);
  },

  foldAll(id) {
    foldAll(viewFor(id));
  },

  unfoldAll(id) {
    unfoldAll(viewFor(id));
  },

  foldAt(id, line) {
    const view = viewFor(id);
    const at = view.state.doc.line(line).from;
    view.dispatch({ selection: { anchor: at } });
    return foldCode(view);
  },

  type(id, text) {
    const view = viewFor(id);
    const at = view.state.selection.main.head;
    view.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + text.length } });
  },

  setCursor(id, pos) {
    const view = viewFor(id);
    view.dispatch({ selection: { anchor: pos } });
    view.focus();
  },

  async completions(id) {
    const view = viewFor(id);
    view.focus();
    startCompletion(view);
    // The completion source is synchronous, but the tooltip is rendered on the
    // next measure cycle, so wait for it rather than for a fixed delay.
    for (let attempt = 0; attempt < 40; attempt++) {
      const options = view.dom.querySelectorAll('.cm-completionLabel');
      if (options.length) return [...options].map((o) => o.textContent ?? '');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return [];
  },

  docOf(id) {
    return viewFor(id).state.doc.toString();
  },
};

document.body.dataset.ready = 'true';
