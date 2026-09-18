/** Interactive demo with syntax-tree and highlight inspectors. */
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit, syntaxTree } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';
import type { Tag } from '@lezer/highlight';

import { nquads, ntriples, trig, turtle } from '@kurrawongai/codemirror-lang-turtle12';
import { sparql, sparqlLanguage } from '@kurrawongai/codemirror-lang-sparql12';
import { dataBlockRanges, ruleRanges, sparqlToSrl, srl, srlConformanceDiagnostics, srlLanguage, srlToSparql, variablesInDataBlocks } from '@kurrawongai/codemirror-lang-srl';

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
let sparqlHelpers = true;

function isSrl(key: LanguageKey = current): boolean {
  return key === 'srl' || key === 'srl-conversion';
}

function extensionFor(key: LanguageKey) {
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
    case 'sparql-conversion':
    case 'sparql-update':
      return sparql({ prefixSource });
    case 'srl':
    case 'srl-conversion':
      return srl({ prefixSource, tuples: false, sparqlConversions: sparqlHelpers });
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
const themeSelect = el<HTMLSelectElement>('theme');
const mediaTypeOut = el('media-type');
const statusOut = el('status');
const errorPanel = el('error-panel');
const errorOut = el('errors');
const cursorOut = el('cursor');
const treeOut = el('tree');
const srlOut = el('srl-facts');
const srlPanel = el('srl-panel');
const conversionPanel = el('conversion-panel');
const conversionStatus = el('conversion-status');
const conversionOut = el('conversion-output');
const exportForm = el<HTMLSelectElement>('export-form');
const exportFormLabel = el('export-form-label');
const conversionDirection = el('conversion-direction');
const convertButton = el<HTMLButtonElement>('convert');
const copyButton = el<HTMLButtonElement>('copy-conversion');
const sparqlHelpersToggle = el<HTMLInputElement>('sparql-helpers');

function sampleFromUrl(): LanguageKey {
  const requested = new URL(window.location.href).searchParams.get('sample');
  return requested && (LANGUAGE_KEYS as readonly string[]).includes(requested)
    ? requested as LanguageKey
    : 'turtle';
}

function updateSampleUrl(key: LanguageKey): void {
  const url = new URL(window.location.href);
  url.searchParams.set('sample', key);
  window.history.replaceState(null, '', url);
}

let current: LanguageKey = sampleFromUrl();

const updateInspector = EditorView.updateListener.of((update) => {
  if (update.docChanged || update.selectionSet || update.viewportChanged) render(update.view);
});

interface SourceUnit {
  from: number;
  to: number;
}

function srlUnits(state: EditorState): SourceUnit[] {
  const found: SourceUnit[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'Rule' || node.name === 'SrlDataBlock') found.push({ from: node.from, to: node.to });
    },
  });
  return found;
}

function selectedSrlUnits(state: EditorState): SourceUnit[] {
  const selection = state.selection.main;
  return srlUnits(state).filter((unit) => selection.empty
    ? unit.from <= selection.head && selection.head <= unit.to
    : unit.from < selection.to && selection.from < unit.to);
}

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
      languageConf.of(extensionFor(current)),
      updateInspector,
    ],
  }),
});

const outputLanguageConf = new Compartment();
let outputShowsSrl = false;
const conversionView = new EditorView({
  parent: conversionOut,
  state: EditorState.create({
    extensions: [
      highlightSpecialChars(),
      drawSelection(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({ 'aria-label': 'Converted source' }),
      demoTheme,
      outputLanguageConf.of(sparqlLanguage),
    ],
  }),
});

function conversionOutput(): string {
  return conversionView.state.doc.toString();
}

function setConversionOutput(text: string): void {
  if (text === conversionOutput()) return;
  conversionView.dispatch({ changes: { from: 0, to: conversionView.state.doc.length, insert: text } });
}

function render(v: EditorView) {
  const pos = v.state.selection.main.head;
  const { rows, truncated } = treeRows(v);
  const issues = parseErrors(v);

  const parseIssueCount = issues.filter((issue) => issue.kind === 'parse').length;
  const srlIssueCount = issues.length - parseIssueCount;
  statusOut.textContent = issues.length === 0
    ? 'no parse errors'
    : parseIssueCount > 0 && srlIssueCount > 0
      ? `${issues.length} errors`
      : srlIssueCount > 0
        ? `${srlIssueCount} SRL error${srlIssueCount === 1 ? '' : 's'}`
        : `${parseIssueCount} parse error${parseIssueCount === 1 ? '' : 's'}`;
  statusOut.dataset.state = issues.length === 0 ? 'ok' : 'error';

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
  renderErrors(v, issues);
  renderSrlFacts(v);
  renderConversionControls();
}

interface ParseIssue {
  from: number;
  to: number;
  message: string;
  kind: 'parse' | 'srl';
}

function parseErrors(v: EditorView): ParseIssue[] {
  const found: ParseIssue[] = [];
  const srlIssues = isSrl()
    ? srlConformanceDiagnostics(v.state).map((issue) => sparqlHelpers ? issue : { ...issue, message: 'Syntax error.' })
    : [];
  syntaxTree(v.state).iterate({
    enter: (node) => {
      if (!node.type.isError || found.some((issue) => issue.from === node.from && issue.to === node.to)) return;
      const text = v.state.sliceDoc(node.from, node.to).trim();
      const message = /^CONSTRUCT$/i.test(text)
        ? 'SPARQL CONSTRUCT is not valid in SRL. Use RULE or convert it.'
        : /^BIND$/i.test(text)
          ? 'SPARQL BIND is not valid SRL. Use SET instead.'
          : `Unexpected ${text ? `“${text.slice(0, 32)}”` : 'syntax'}.`;
      if (srlIssues.some((issue) => issue.from <= node.from && node.to <= issue.to)) return;
      found.push({ from: node.from, to: node.to, message, kind: 'parse' });
    },
  });
  for (const issue of srlIssues) {
    if (!found.some((existing) => existing.from === issue.from && existing.to === issue.to))
      found.push({ ...issue, kind: 'srl' });
  }
  return found;
}

function renderErrors(v: EditorView, issues: ParseIssue[]) {
  errorPanel.hidden = issues.length === 0;
  const fragment = document.createDocumentFragment();
  for (const issue of issues) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'error-row';
    button.textContent = `Line ${v.state.doc.lineAt(issue.from).number}: ${issue.message}`;
    button.addEventListener('click', () => {
      v.dispatch({ selection: { anchor: issue.from, head: issue.to }, scrollIntoView: true });
      v.focus();
    });
    fragment.append(button);
  }
  errorOut.replaceChildren(fragment);
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

/** Rule and data-block spans, plus variables in ground DATA blocks. */
function renderSrlFacts(v: EditorView) {
  if (!isSrl()) {
    srlPanel.hidden = true;
    return;
  }
  srlPanel.hidden = false;
  const rules = ruleRanges(v.state);
  const data = dataBlockRanges(v.state);
  const badVars = variablesInDataBlocks(v.state);

  const lineOf = (from: number) => v.state.doc.lineAt(from).number;
  srlOut.replaceChildren(
    field('rules', rules.length ? rules.map((r) => `line ${lineOf(r.from)}`).join(', ') : 'none'),
    field('DATA blocks', data.length ? data.map((r) => `line ${lineOf(r.from)}`).join(', ') : 'none'),
    field(
      'variables in DATA',
      badVars.length ? badVars.map((x) => `${x.name} @ line ${lineOf(x.from)}`).join(', ') : 'none — all ground'
    )
  );
  srlOut
    .querySelectorAll('.field')
    [2]?.classList.toggle('is-warning', badVars.length > 0);
}

function renderConversionControls() {
  const convertible = isSrl() || current === 'sparql' || current === 'sparql-conversion';
  conversionPanel.hidden = !convertible;
  exportFormLabel.hidden = !convertible;
  conversionDirection.textContent = isSrl() ? 'Convert to SPARQL' : 'Convert to SRL Rule';
  exportForm.hidden = !isSrl();
  convertButton.textContent = 'Convert';
  const nextOutputShowsSrl = !isSrl();
  if (convertible && nextOutputShowsSrl !== outputShowsSrl) {
    outputShowsSrl = nextOutputShowsSrl;
    conversionView.dispatch({ effects: outputLanguageConf.reconfigure(outputShowsSrl ? srlLanguage : sparqlLanguage) });
  }
  if (!convertible) {
    conversionStatus.textContent = '';
    setConversionOutput('');
  }
}

function prologueBefore(pos: number): string {
  const declarations: { from: number; to: number }[] = [];
  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.to <= pos && (node.name === 'BaseDecl' || node.name === 'PrefixDecl' || node.name === 'VersionDecl'))
        declarations.push({ from: node.from, to: node.to });
    },
  });
  return declarations.map((node) => view.state.sliceDoc(node.from, node.to)).join('\n');
}

function convertCurrent() {
  const originalSelection = view.state.selection.main;
  const units = isSrl() ? selectedSrlUnits(view.state) : [];
  if (units.length > 1) {
    setConversionOutput('');
    conversionStatus.textContent = 'Select one RULE or DATA block to preview its conversion.';
    conversionStatus.dataset.state = 'error';
    return;
  }
  const unit = units[0];
  if (unit && (originalSelection.from !== unit.from || originalSelection.to !== unit.to))
    view.dispatch({ selection: { anchor: unit.from, head: unit.to }, scrollIntoView: true });
  const hasSelection = !!unit || !originalSelection.empty;
  const from = unit?.from ?? originalSelection.from;
  const to = unit?.to ?? originalSelection.to;
  const context = hasSelection ? prologueBefore(from) : '';
  const source = hasSelection ? `${context}${context ? '\n' : ''}${view.state.sliceDoc(from, to)}` : view.state.doc.toString();
  const offset = hasSelection ? from - context.length - (context ? 1 : 0) : 0;
  const result = isSrl() ? srlToSparql(source, { form: exportForm.value as 'construct' | 'insert' }) : sparqlToSrl(source);
  if (!result.text) {
    setConversionOutput('');
    conversionStatus.textContent = result.diagnostics.map((d) => `line ${view.state.doc.lineAt(offset + d.from).number}: ${d.message}`).join('\n');
    conversionStatus.dataset.state = 'error';
    if (result.diagnostics[0]) view.dispatch({ selection: { anchor: offset + result.diagnostics[0].from, head: offset + result.diagnostics[0].to }, scrollIntoView: true });
    return;
  }
  setConversionOutput(result.text);
  conversionStatus.textContent = unit
    ? 'Preview of the highlighted RULE or DATA block.'
    : hasSelection ? 'Preview of the selected source.' : 'Preview of the document.';
  conversionStatus.dataset.state = 'ok';
}

async function copyConversion() {
  const output = conversionOutput();
  if (!output) return;
  try {
    await navigator.clipboard.writeText(output);
    conversionStatus.textContent = 'Copied to clipboard.';
    conversionStatus.dataset.state = 'ok';
  } catch {
    conversionView.dispatch({ selection: { anchor: 0, head: conversionView.state.doc.length } });
    conversionView.focus();
    document.execCommand('copy');
    conversionStatus.textContent = 'Selected for copying.';
    conversionStatus.dataset.state = 'ok';
  }
}

function selectLanguage(key: LanguageKey, { resetDoc = true } = {}) {
  current = key;
  updateSampleUrl(key);
  languageSelect.value = key;
  mediaTypeOut.textContent = SAMPLES[key].mediaType;
  conversionStatus.textContent = '';
  setConversionOutput('');

  view.dispatch({
    changes: resetDoc ? { from: 0, to: view.state.doc.length, insert: SAMPLES[key].doc } : undefined,
    effects: languageConf.reconfigure(extensionFor(key)),
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

sparqlHelpersToggle.checked = sparqlHelpers;
sparqlHelpersToggle.addEventListener('change', () => {
  sparqlHelpers = sparqlHelpersToggle.checked;
  if (isSrl()) view.dispatch({ effects: languageConf.reconfigure(extensionFor(current)) });
});

el<HTMLButtonElement>('reset').addEventListener('click', () => selectLanguage(current));
convertButton.addEventListener('click', convertCurrent);
copyButton.addEventListener('click', copyConversion);

// The highlight style resolves these custom properties at paint time, so a
// theme change does not require either editor to be recreated.
const systemDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(): void {
  const selected = themeSelect.value;
  document.documentElement.dataset.theme = selected === 'system'
    ? systemDarkTheme.matches ? 'dark' : 'light'
    : selected;
}
themeSelect.value = 'system';
themeSelect.addEventListener('change', applyTheme);
systemDarkTheme.addEventListener('change', () => {
  if (themeSelect.value === 'system') applyTheme();
});
applyTheme();

selectLanguage(current);
view.focus();
