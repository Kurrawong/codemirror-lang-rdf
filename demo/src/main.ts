/**
 * The demo editor.
 *
 * Two jobs. For someone deciding whether to use these packages, it is the
 * fastest way to see what the grammars do. For someone *changing* a grammar, it
 * is the inspector the tests cannot be: the syntax tree beside the document,
 * the tag under the cursor, and the error count updating as you type — which is
 * how you find out that a token went to the wrong term long before a
 * conformance file tells you.
 */
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit, syntaxTree } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import type { Tag } from '@lezer/highlight';

import { nquads, ntriples, trig, turtle } from '@kurrawongai/codemirror-lang-turtle12';
import { sparql } from '@kurrawongai/codemirror-lang-sparql12';
import { dataBlockRanges, ruleRanges, srl, tupleRanges, variablesInDataBlocks } from '@kurrawongai/codemirror-lang-srl';

import { LANGUAGE_KEYS, SAMPLES, type LanguageKey } from './samples';
import { demoTheme } from './theme';

/**
 * A prefix map an application would supply from its own prefix manager, to
 * show that completion offers more than the document declares.
 */
const WORKSPACE_PREFIXES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  sh: 'http://www.w3.org/ns/shacl#',
  foaf: 'http://xmlns.com/foaf/0.1/',
};

const languageConf = new Compartment();

function extensionFor(key: LanguageKey, tuples: boolean) {
  const prefixSource = WORKSPACE_PREFIXES;
  switch (key) {
    case 'turtle':
      return turtle({ prefixSource });
    case 'trig':
      return trig({ prefixSource });
    case 'ntriples':
      return ntriples();
    case 'nquads':
      return nquads();
    case 'sparql':
    case 'sparql-update':
      return sparql({ prefixSource });
    case 'srl':
      return srl({ prefixSource, tuples });
  }
}

// ---------------------------------------------------------------- inspector

/**
 * The tag the highlighter would give the token under the cursor.
 *
 * Highlighting one line rather than the document keeps this cheap on every
 * cursor move, and a token never spans a line in these languages except inside
 * a long string, where the answer is the same either way.
 */
const TAG_NAMES = [
  'comment', 'keyword', 'url', 'namespace', 'variableName', 'propertyName',
  'string', 'number', 'bool', 'typeName', 'annotation', 'brace',
  'squareBracket', 'paren', 'operator', 'separator', 'punctuation', 'invalid',
] as const;

/**
 * The RDF 1.2 term brackets, which are `special()` derivations. Listed so the
 * inspector reports the *specific* tag rather than the standard one it falls
 * back to — knowing that `<<` came out as `reifiedTripleBracket` and not merely
 * as some kind of bracket is the whole reason to look.
 */
const DERIVED_TAGS: Record<string, Tag> = {
  reifiedTripleBracket: tags.special(tags.angleBracket),
  tripleTermBracket: tags.special(tags.paren),
  annotationBrace: tags.special(tags.brace),
  reifier: tags.special(tags.operator),
};

const inspectorHighlighter = tagHighlighter([
  ...TAG_NAMES.map((name) => ({ tag: (tags as unknown as Record<string, Tag>)[name], class: name })),
  ...Object.entries(DERIVED_TAGS).map(([name, tag]) => ({ tag, class: name })),
]);

function tagAt(view: EditorView, pos: number): { text: string; tag: string } | null {
  const line = view.state.doc.lineAt(pos);
  let found: { text: string; tag: string } | null = null;
  highlightTree(
    syntaxTree(view.state),
    inspectorHighlighter,
    (from, to, cls) => {
      if (from <= pos && pos <= to) found = { text: view.state.sliceDoc(from, to), tag: cls };
    },
    line.from,
    line.to
  );
  return found;
}

/** The named nodes from the top of the tree down to the cursor. */
function pathAt(view: EditorView, pos: number): string[] {
  const path: string[] = [];
  for (let node = syntaxTree(view.state).resolveInner(pos, -1); node; node = node.parent!) {
    if (/^[A-Za-z]/.test(node.name)) path.unshift(node.name);
    if (!node.parent) break;
  }
  return path;
}

interface TreeRow {
  name: string;
  from: number;
  to: number;
  depth: number;
  error: boolean;
}

const MAX_ROWS = 4000;

function treeRows(view: EditorView): { rows: TreeRow[]; truncated: boolean; errors: number } {
  const rows: TreeRow[] = [];
  let depth = 0;
  let errors = 0;
  let truncated = false;
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.type.isError) errors++;
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        return false;
      }
      // Anonymous literal tokens (`.`, `{`) are in the tree for bracket
      // matching; showing them would treble the row count and bury the
      // productions this pane exists to show.
      if (node.type.isError || /^[A-Za-z]/.test(node.name)) {
        rows.push({ name: node.name, from: node.from, to: node.to, depth, error: node.type.isError });
        depth++;
        return true;
      }
      return false;
    },
    leave: (node) => {
      if (node.type.isError || /^[A-Za-z]/.test(node.name)) depth--;
    },
  });
  return { rows, truncated, errors };
}

// -------------------------------------------------------------------- page

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const languageSelect = el<HTMLSelectElement>('language');
const paletteSelect = el<HTMLSelectElement>('palette');
const tuplesToggle = el<HTMLInputElement>('tuples');
const tuplesField = el('tuples-field');
const mediaTypeOut = el('media-type');
const statusOut = el('status');
const cursorOut = el('cursor');
const treeOut = el('tree');
const srlOut = el('srl-facts');
const srlPanel = el('srl-panel');

let current: LanguageKey = 'turtle';
let tuples = true;

const updateInspector = EditorView.updateListener.of((update) => {
  if (update.docChanged || update.selectionSet || update.viewportChanged) render(update.view);
});

const view = new EditorView({
  parent: el('editor'),
  state: EditorState.create({
    doc: SAMPLES[current].doc,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      indentUnit.of('  '),
      bracketMatching(),
      closeBrackets(),
      autocompletion({ activateOnTyping: true }),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      demoTheme,
      languageConf.of(extensionFor(current, tuples)),
      updateInspector,
    ],
  }),
});

function render(v: EditorView) {
  const pos = v.state.selection.main.head;
  const { rows, truncated, errors } = treeRows(v);

  statusOut.textContent = errors === 0 ? 'no parse errors' : `${errors} parse error${errors === 1 ? '' : 's'}`;
  statusOut.dataset.state = errors === 0 ? 'ok' : 'error';

  const line = v.state.doc.lineAt(pos);
  const tag = tagAt(v, pos);
  const path = pathAt(v, pos);
  cursorOut.innerHTML = '';
  cursorOut.append(
    field('line', `${line.number}:${pos - line.from + 1}`),
    field('tag', tag ? tag.tag : '—'),
    field('path', path.length ? path.join(' › ') : '—')
  );

  renderTree(v, rows, truncated, pos);
  renderSrlFacts(v);
}

function field(label: string, value: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const k = document.createElement('span');
  k.className = 'field-label';
  k.textContent = label;
  const val = document.createElement('span');
  val.className = 'field-value';
  val.textContent = value;
  wrap.append(k, val);
  return wrap;
}

function renderTree(v: EditorView, rows: TreeRow[], truncated: boolean, pos: number) {
  const frag = document.createDocumentFragment();
  for (const row of rows) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'tree-row';
    if (row.error) node.classList.add('is-error');
    if (row.from <= pos && pos <= row.to) node.classList.add('is-current');
    node.style.paddingLeft = `${6 + row.depth * 12}px`;
    node.textContent = row.error ? '⚠ error' : row.name;

    const span = document.createElement('span');
    span.className = 'tree-span';
    const text = v.state.sliceDoc(row.from, Math.min(row.to, row.from + 40)).replace(/\s+/g, ' ');
    span.textContent = text + (row.to - row.from > 40 ? '…' : '');
    node.append(span);

    // Clicking a node selects what it covers: the quickest way to check that a
    // production spans what you think it does.
    node.addEventListener('click', () => {
      v.dispatch({ selection: { anchor: row.from, head: row.to }, scrollIntoView: true });
      v.focus();
    });
    frag.append(node);
  }
  if (truncated) {
    const more = document.createElement('div');
    more.className = 'tree-truncated';
    more.textContent = `… truncated at ${MAX_ROWS} nodes`;
    frag.append(more);
  }
  treeOut.replaceChildren(frag);
  treeOut.querySelector('.is-current')?.scrollIntoView({ block: 'nearest' });
}

/**
 * The tree facts `@kurrawongai/codemirror-lang-srl` exports for an application to build on:
 * rule and data-block spans for a gutter, tuple spans for the extension gate,
 * and variables in a ground DATA block for a linter.
 */
function renderSrlFacts(v: EditorView) {
  if (current !== 'srl') {
    srlPanel.hidden = true;
    return;
  }
  srlPanel.hidden = false;
  const rules = ruleRanges(v.state);
  const data = dataBlockRanges(v.state);
  const tupleSpans = tupleRanges(v.state);
  const badVars = variablesInDataBlocks(v.state);

  const lineOf = (from: number) => v.state.doc.lineAt(from).number;
  srlOut.replaceChildren(
    field('rules', rules.length ? rules.map((r) => `line ${lineOf(r.from)}`).join(', ') : 'none'),
    field('DATA blocks', data.length ? data.map((r) => `line ${lineOf(r.from)}`).join(', ') : 'none'),
    field(
      'tuples',
      tupleSpans.length
        ? tupleSpans.map((r) => `${r.kind === 'TupleTemplate' ? 'head' : 'body'} @ line ${lineOf(r.from)}`).join(', ')
        : 'none'
    ),
    field(
      'variables in DATA',
      badVars.length ? badVars.map((x) => `${x.name} @ line ${lineOf(x.from)}`).join(', ') : 'none — all ground'
    )
  );
  srlOut
    .querySelectorAll('.field')
    [3]?.classList.toggle('is-warning', badVars.length > 0);
  if (!tuples && tupleSpans.length) {
    srlOut.querySelectorAll('.field')[2]?.classList.add('is-warning');
  }
}

function selectLanguage(key: LanguageKey, { resetDoc = true } = {}) {
  current = key;
  languageSelect.value = key;
  tuplesField.hidden = key !== 'srl';
  mediaTypeOut.textContent = SAMPLES[key].mediaType;

  view.dispatch({
    changes: resetDoc ? { from: 0, to: view.state.doc.length, insert: SAMPLES[key].doc } : undefined,
    effects: languageConf.reconfigure(extensionFor(key, tuples)),
  });
  render(view);
}

/**
 * The palettes, which all drive the one `HighlightStyle` in `theme.ts`.
 *
 * They exist to make a point rather than to be shipped: the packages tag, an
 * application colours. `rdf12` is the default because the distinction it draws
 * is the reason the 1.2 tags exist; `conventional` is there to show that a
 * style which ignores them loses nothing.
 */
const PALETTES = [
  { id: 'rdf12', label: 'RDF 1.2 emphasis' },
  { id: 'conventional', label: 'Conventional' },
  { id: 'terms', label: 'Terms first' },
] as const;

for (const { id, label } of PALETTES) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = label;
  paletteSelect.append(option);
}

paletteSelect.addEventListener('change', () => {
  document.documentElement.dataset.palette = paletteSelect.value;
});
document.documentElement.dataset.palette = PALETTES[0].id;

for (const key of LANGUAGE_KEYS) {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = SAMPLES[key].label;
  languageSelect.append(option);
}

languageSelect.addEventListener('change', () => selectLanguage(languageSelect.value as LanguageKey));
tuplesToggle.addEventListener('change', () => {
  tuples = tuplesToggle.checked;
  // Keep the document: the point is that switching the flag does not change
  // what parses, only what the editor recommends.
  selectLanguage(current, { resetDoc: false });
});

el<HTMLButtonElement>('reset').addEventListener('click', () => selectLanguage(current));

// Theme toggle: the highlight style resolves its custom properties at paint
// time, so flipping an attribute on <html> is the whole implementation.
const themeToggle = el<HTMLButtonElement>('theme');
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  themeToggle.textContent = next === 'dark' ? 'Light' : 'Dark';
});

selectLanguage(current);
view.focus();
