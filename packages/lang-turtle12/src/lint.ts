import { ensureSyntaxTree } from '@codemirror/language';
import { linter } from '@codemirror/lint';
import type { EditorState, Extension } from '@codemirror/state';

export interface ParseError {
  from: number;
  to: number;
  message: string;
}

/**
 * How long to spend completing the parse before reporting errors. A partial
 * tree ends in error nodes that are not in the document, so nothing is
 * reported until the parse reaches the end.
 */
const PARSE_TIMEOUT_MS = 1000;

/** Whitespace and `#` comments: what may separate error nodes in one run. */
const GAP = /^(?:\s|#.*)*$/;

/**
 * Every parse error in the document.
 *
 * The parser recovers by skipping one token at a time, so `this is a test`
 * produces four error nodes. Nodes separated only by whitespace or comments are
 * merged into one error.
 */
export function parseErrors(state: EditorState): ParseError[] {
  const tree = ensureSyntaxTree(state, state.doc.length, PARSE_TIMEOUT_MS);
  if (!tree) return [];
  const runs: { from: number; to: number }[] = [];
  tree.iterate({
    enter: (node) => {
      if (!node.type.isError) return;
      const last = runs[runs.length - 1];
      if (last && (node.from <= last.to || GAP.test(state.sliceDoc(last.to, node.from))))
        last.to = Math.max(last.to, node.to);
      else runs.push({ from: node.from, to: node.to });
    },
  });
  return runs.map(({ from, to }) => ({ from, to, message: errorMessage(state.sliceDoc(from, to)) }));
}

function errorMessage(text: string): string {
  const shown = text.replace(/\s+/g, ' ').trim();
  if (!shown) return 'Syntax error.';
  return `Unexpected “${shown.length > 32 ? `${shown.slice(0, 32)}…` : shown}”.`;
}

/** Underline every parse error. Included in `turtle()`, `trig()`, `ntriples()` and `nquads()`. */
export function parseErrorLinter(): Extension {
  return linter((view) => parseErrors(view.state).map((error) => ({ ...error, severity: 'error' })));
}
