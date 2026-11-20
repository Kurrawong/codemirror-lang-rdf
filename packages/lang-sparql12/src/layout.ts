// The layout engine that the Turtle, SPARQL and SRL formatters share.
//
// This file is kept byte-identical in `lang-turtle12/src/layout.ts` and
// `lang-sparql12/src/layout.ts`, because neither package depends on the other.
// `test/layout-copies.test.ts` fails if the two copies differ.

import type { SyntaxNode, Tree } from '@lezer/common';
import type { LRParser } from '@lezer/lr';

/** What separates two adjacent tokens in the output. */
export type Space = 'none' | 'space' | 'line';

/** One whitespace edit, in the coordinates of the input text. */
export interface FormatChange {
  from: number;
  to: number;
  insert: string;
}

/** Why a document was not formatted. */
export interface FormatError {
  from: number;
  to: number;
  message: string;
}

export interface FormatResult {
  /** The formatted text, or the input unchanged when `error` is set. */
  text: string;
  /** The edits that turn the input into `text`. Empty when `error` is set. */
  changes: FormatChange[];
  /** Set when the input has a parse error. */
  error: FormatError | null;
}

export interface FormatOptions {
  /** The text of one indent level. Defaults to two spaces. */
  indent?: string;
}

/**
 * A token: a leaf of the tree, or text the grammar matched with an anonymous
 * token, which has no node. For an anonymous token, `name` is its text and
 * `parent` is the node around it.
 */
export interface Token {
  name: string;
  from: number;
  to: number;
  parent: SyntaxNode | null;
}

/**
 * Where a language breaks lines. The engine handles comments, indentation,
 * blank lines and blocks; the rules only name nodes and token pairs.
 */
export interface LayoutRules {
  /**
   * Whether this node starts on a new line. The engine asks for a token and
   * for each ancestor that starts where the token starts.
   */
  startsLine(node: Token): boolean;
  /** The separator between two adjacent tokens. `undefined` means one space. */
  between(prev: Token, next: Token): Space | undefined;
  /**
   * Whether a token opens a block. `always`: the content goes on its own
   * lines unless the block is empty. `auto`: only when the content has a line
   * break in it, such as a `;` list or a comment.
   */
  block(opener: Token): 'always' | 'auto' | null;
  /**
   * Whether a node is a list whose continuation lines are indented one level
   * deeper than the line it starts on, such as a `;` predicate list.
   */
  isList(node: SyntaxNode): boolean;
}

const CLOSERS: Record<string, string> = { '{': '}', '[': ']', '{|': '|}', '(': ')' };

interface Block {
  broken: boolean;
  closer: number;
}

interface Frame {
  level: number | undefined;
  /** For a block frame, the level of the line its closer goes on. */
  close?: number;
}

type Event = { kind: 'leaf'; index: number } | { kind: 'push' } | { kind: 'pop' };

/**
 * Every token in the text, comments included, and where each list node starts
 * and ends. A token that the tree has no node for comes after the list nodes
 * that end before it and before the ones that start after it.
 */
function walk(tree: Tree, text: string, rules: LayoutRules | null): { leaves: Token[]; events: Event[] } {
  const leaves: Token[] = [];
  const events: Event[] = [];
  const lists: boolean[] = [];
  let end = 0;
  // Pushes wait here until the next leaf, so that anonymous tokens before
  // that leaf are placed ahead of them.
  let pushes = 0;
  const leaf = (node: Token) => {
    for (const match of text.slice(end, node.from).matchAll(/\S+/g)) {
      const from = end + match.index!;
      leaves.push({ name: match[0], from, to: from + match[0].length, parent: tree.resolveInner(from, 1) });
      events.push({ kind: 'leaf', index: leaves.length - 1 });
    }
    for (; pushes > 0; pushes--) events.push({ kind: 'push' });
    if (node.to > node.from) {
      leaves.push(node);
      events.push({ kind: 'leaf', index: leaves.length - 1 });
    }
    end = Math.max(end, node.to);
  };
  const pop = () => {
    if (pushes > 0) pushes--;
    else events.push({ kind: 'pop' });
  };
  const cursor = tree.cursor();
  for (;;) {
    const node = cursor.node;
    const list = rules !== null && rules.isList(node);
    if (list) pushes++;
    if (cursor.firstChild()) {
      lists.push(list);
      continue;
    }
    if (node.to > node.from) leaf(node);
    if (list) pop();
    while (!cursor.nextSibling()) {
      if (!cursor.parent()) {
        leaf({ name: '', from: text.length, to: text.length, parent: null });
        return { leaves, events };
      }
      if (lists.pop()) pop();
    }
  }
}

function firstError(tree: Tree): FormatError | null {
  let found: FormatError | null = null;
  tree.iterate({
    enter: (node) => {
      if (found) return false;
      if (node.type.isError) found = { from: node.from, to: node.to, message: 'The document has a parse error.' };
      return undefined;
    },
  });
  return found;
}

const unchanged = (text: string, error: FormatError): FormatResult => ({ text, changes: [], error });

/**
 * Format `text` by changing only the whitespace between its tokens.
 *
 * Returns the input unchanged, with `error` set, when the parse has an error
 * node or when the output does not parse to the same tokens as the input.
 */
export function formatTree(parser: LRParser, rules: LayoutRules, text: string, options: FormatOptions = {}): FormatResult {
  const indent = options.indent ?? '  ';
  const tree = parser.parse(text);
  const error = firstError(tree);
  if (error) return unchanged(text, error);

  const { leaves, events } = walk(tree, text, rules);
  if (leaves.length === 0) return { text, changes: [], error: null };
  const isComment = (n: Token) => n.name === 'Comment';

  // The whitespace before each token, and after the last.
  const gaps: string[] = [];
  for (let i = 0; i <= leaves.length; i++)
    gaps.push(text.slice(i === 0 ? 0 : leaves[i - 1].to, i === leaves.length ? text.length : leaves[i].from));

  // Pair each block opener with its closer and decide whether it breaks.
  const indexOf = new Map<number, number>();
  leaves.forEach((leaf, i) => indexOf.set(leaf.from, i));
  const startsLine = (leaf: Token) => {
    for (let n: Token | null = leaf; n && n.from === leaf.from; n = n.parent) if (rules.startsLine(n)) return true;
    return false;
  };
  const opened = new Map<number, Block>();
  const closes = new Map<number, number>();
  for (let i = 0; i < leaves.length; i++) {
    const kind = rules.block(leaves[i]);
    const parent = leaves[i].parent;
    const closerName = CLOSERS[leaves[i].name];
    if (!kind || !parent || !closerName) continue;
    const closerNode = parent.getChildren(closerName).find((c) => c.from > leaves[i].from);
    const closer = closerNode ? indexOf.get(closerNode.from) : undefined;
    if (closer === undefined) continue;
    opened.set(i, { broken: closer > i + 1 && kind === 'always', closer });
    closes.set(closer, i);
  }
  // `auto` blocks break when their content does. Inner blocks are decided first
  // so that an outer block sees an inner one that broke.
  const autos = [...opened.entries()].filter(([i]) => rules.block(leaves[i]) === 'auto').sort((a, b) => a[1].closer - b[1].closer);
  for (const [open, block] of autos) {
    for (let j = open + 1; j < block.closer && !block.broken; j++) {
      if (isComment(leaves[j]) || opened.get(j)?.broken || startsLine(leaves[j])) block.broken = true;
      else if (j + 1 < block.closer && rules.between(leaves[j], leaves[j + 1]) === 'line') block.broken = true;
    }
  }

  const frames: Frame[] = [];
  const level = () => {
    for (let k = frames.length - 1; k >= 0; k--) {
      const at = frames[k].level;
      if (at !== undefined) return at;
    }
    return 0;
  };
  let lineLevel = 0;
  // seps[k] goes before token k; seps[n] after the last token.
  const seps: string[] = [];
  const tokens: string[] = [];

  for (const event of events) {
    if (event.kind === 'push') {
      frames.push({ level: undefined });
      continue;
    }
    if (event.kind === 'pop') {
      frames.pop();
      continue;
    }
    const i = event.index;
    const leaf = leaves[i];
    let sep = '';
    let beganLine = false;
    if (i > 0) {
      const prev = leaves[i - 1];
      const gap = gaps[i];
      const opener = closes.get(i);
      const closesBroken = opener !== undefined && opened.get(opener)!.broken;
      const afterBroken = opened.get(i - 1)?.broken === true;
      let kind: Space;
      let at: number | undefined;
      if (isComment(leaf) && !gap.includes('\n')) kind = 'space';
      else if (closesBroken) {
        kind = 'line';
        // The block's own frame is on top: every list inside it has ended.
        at = frames.pop()!.close;
      } else if (isComment(prev) || isComment(leaf) || afterBroken || startsLine(leaf)) kind = 'line';
      else kind = rules.between(prev, leaf) ?? 'space';
      if (kind === 'line') {
        lineLevel = at ?? level();
        const blank = /\n[^\S\n]*\n/.test(gap) && !afterBroken && !closesBroken;
        sep = (blank ? '\n\n' : '\n') + indent.repeat(lineLevel);
        beganLine = true;
      } else sep = kind === 'space' ? ' ' : '';
    }
    seps.push(sep);
    // Trailing spaces inside a comment token are the only change made inside a token.
    tokens.push(isComment(leaf) ? text.slice(leaf.from, leaf.to).trimEnd() : text.slice(leaf.from, leaf.to));

    // Lists that start at this token: a list that starts a line continues at
    // that line's level, and one that starts mid-line one level deeper.
    let below = 0;
    for (const frame of frames) {
      if (frame.level === undefined) frame.level = beganLine || i === 0 ? lineLevel : below + 1;
      below = frame.level;
    }
    if (opened.get(i)?.broken) frames.push({ level: lineLevel + 1, close: lineLevel });
  }
  seps.push(gaps[leaves.length].includes('\n') ? '\n' : '');

  let result = '';
  for (let k = 0; k < tokens.length; k++) result += seps[k] + tokens[k];
  result += seps[tokens.length];

  // Every token must come back as it went in. A rule that glued two tokens
  // into one fails here instead of changing the document.
  const check = parser.parse(result);
  const again = firstError(check) ? null : walk(check, result, null).leaves;
  const same =
    again !== null &&
    again.length === leaves.length &&
    again.every((n, k) => n.name === leaves[k].name && result.slice(n.from, n.to).trimEnd() === tokens[k]);
  if (!same) return unchanged(text, { from: 0, to: 0, message: 'The formatted text did not parse to the same tokens.' });

  const changes: FormatChange[] = [];
  for (let k = 0; k <= leaves.length; k++) {
    const from = k === 0 ? 0 : leaves[k - 1].from + tokens[k - 1].length;
    const to = k === leaves.length ? text.length : leaves[k].from;
    if (text.slice(from, to) !== seps[k]) changes.push({ from, to, insert: seps[k] });
  }
  return { text: result, changes, error: null };
}
