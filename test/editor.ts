/**
 * Editor-behaviour helpers: the third test layer.
 *
 * Folding, indentation and completion are what a grammar is *for*, and none of
 * them are visible in a parse tree. These drive the real CodeMirror APIs
 * against a headless `EditorState`, so a test failure means the editor would
 * have misbehaved, not merely that a node moved.
 */
import { EditorState } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { foldable, getIndentation, indentUnit, language } from '@codemirror/language';
import { CompletionContext } from '@codemirror/autocomplete';
import type { Completion } from '@codemirror/autocomplete';

export function stateFor(doc: string, extensions: Extension): EditorState {
  return EditorState.create({ doc, extensions: [extensions, indentUnit.of('  ')] });
}

/**
 * The fold range for the line containing `find`, as the text it would hide.
 *
 * Returning the hidden text rather than offsets keeps the expectations legible
 * and makes an off-by-one in a fold range obvious rather than arithmetic.
 */
export function foldedText(state: EditorState, find: string): string | null {
  const at = state.doc.toString().indexOf(find);
  if (at < 0) throw new Error(`not in document: ${find}`);
  const line = state.doc.lineAt(at);
  const range = foldable(state, line.from, line.to);
  return range ? state.doc.sliceString(range.from, range.to) : null;
}

/** Every line that offers a fold, by 1-based line number. */
export function foldableLines(state: EditorState): number[] {
  const lines: number[] = [];
  for (let i = 1; i <= state.doc.lines; i++) {
    const line = state.doc.line(i);
    if (foldable(state, line.from, line.to)) lines.push(i);
  }
  return lines;
}

/**
 * The indentation the language would give the line containing `find`.
 *
 * `getIndentation` is asked at the line start, which is what CodeMirror does
 * when reindenting, so the number here is the number a user would see.
 */
export function indentAt(state: EditorState, find: string): number | null {
  const at = state.doc.toString().indexOf(find);
  if (at < 0) throw new Error(`not in document: ${find}`);
  return getIndentation(state, state.doc.lineAt(at).from);
}

/** Indentation for a new line inserted at `pos` (default: end of document). */
export function indentAfter(doc: string, extensions: Extension, pos = doc.length): number | null {
  const state = stateFor(`${doc}\n`, extensions);
  return getIndentation(state, Math.min(pos + 1, state.doc.length));
}

/**
 * The completions offered at the end of `doc`.
 *
 * The language's own `autocomplete` language-data is used, so this exercises
 * the source the package actually ships rather than one the test wires up.
 */
export async function completionsAt(doc: string, extensions: Extension, explicit = false): Promise<Completion[]> {
  const state = stateFor(doc, extensions);
  const pos = doc.length;
  const sources = state.languageDataAt<(c: CompletionContext) => unknown>('autocomplete', pos);
  if (sources.length === 0) throw new Error('the language provides no completion source');
  const context = new CompletionContext(state, pos, explicit);
  const results: Completion[] = [];
  for (const source of sources) {
    const result = await source(context);
    if (result && typeof result === 'object' && 'options' in result)
      results.push(...(result as { options: Completion[] }).options);
  }
  return results;
}

export function completionLabels(options: Completion[]): string[] {
  return options.map((o) => o.label);
}

/** Sanity check that a state really has the language attached. */
export function languageName(state: EditorState): string | undefined {
  return state.facet(language)?.name;
}
