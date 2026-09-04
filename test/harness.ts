/**
 * The one conformance harness, shared by all three packages.
 *
 * A grammar conforms if it agrees with the W3C suite about which documents
 * parse: a positive test must produce a tree with no error node, a negative
 * test at least one. Nothing else about the tree is asserted here — that is
 * what the per-package tree tests are for.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LRParser } from '@lezer/lr';
import type { Tag } from '@lezer/highlight';
import { highlightTree, tagHighlighter, tags } from '@lezer/highlight';

export interface CorpusEntry {
  name: string;
  file: string;
  expect: 'positive' | 'negative';
}

export interface ExpectedFail {
  [group: string]: Record<string, string> | string[];
}

export function readCorpus(dir: string): CorpusEntry[] {
  const index = join(dir, 'index.json');
  if (!existsSync(index)) throw new Error(`no vendored corpus at ${dir} — run pnpm vendor-corpus`);
  return JSON.parse(readFileSync(index, 'utf8')) as CorpusEntry[];
}

export function readExpectedFail(file: string, group: string): Set<string> {
  const all = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  const entry = all[group];
  if (!entry) return new Set();
  return new Set(Object.keys(entry as Record<string, string>));
}

/** Every error node in the tree, as `from-to` offsets. */
export function errorRanges(parser: LRParser, text: string): string[] {
  const found: string[] = [];
  parser.parse(text).iterate({
    enter: (node) => {
      if (node.type.isError) found.push(`${node.from}-${node.to}`);
    },
  });
  return found;
}

export function parsesCleanly(parser: LRParser, text: string): boolean {
  return errorRanges(parser, text).length === 0;
}

export interface ConformanceResult {
  entry: CorpusEntry;
  /** Did the grammar agree with the suite? */
  agreed: boolean;
  errors: string[];
}

export function runConformance(parser: LRParser, dir: string): ConformanceResult[] {
  return readCorpus(dir).map((entry) => {
    const text = readFileSync(join(dir, entry.file), 'utf8');
    const errors = errorRanges(parser, text);
    const agreed = entry.expect === 'positive' ? errors.length === 0 : errors.length > 0;
    return { entry, agreed, errors };
  });
}

/**
 * A compact rendering of the named nodes in a parse, e.g.
 * `TurtleDoc(Triples(PrefixedName(PNameLN),…))`.
 *
 * Literal tokens (`.`, `(`, `<<(`) are left out: they are in the tree for
 * bracket matching and highlighting, but a consumer navigating by spec
 * vocabulary reads the named productions, and including punctuation in every
 * expectation would bury the structure the test is about.
 */
export function shapeOf(parser: LRParser, text: string): string {
  const cursor = parser.parse(text).cursor();
  const named = (name: string) => /^[A-Za-z]/.test(name);
  const build = (): string | null => {
    const name = cursor.name;
    const kids: string[] = [];
    if (cursor.firstChild()) {
      do {
        const child = build();
        if (child) kids.push(child);
      } while (cursor.nextSibling());
      cursor.parent();
    }
    if (!named(name)) return kids.length ? kids.join(',') : null;
    return kids.length ? `${name}(${kids.join(',')})` : name;
  };
  return build() ?? '';
}

/**
 * The highlight tags a document's tokens actually get.
 *
 * Written against `@lezer/highlight` directly rather than a `HighlightStyle`,
 * so the assertion is about the grammar's tags and not about any one
 * application's colours. `docs/highlight-tags.md` is the table these tests
 * hold the grammars to.
 */
const TAG_NAMES = [
  'comment',
  'keyword',
  'url',
  'namespace',
  'variableName',
  'propertyName',
  'string',
  'number',
  'bool',
  'typeName',
  'annotation',
  'brace',
  'squareBracket',
  'paren',
  'operator',
  'separator',
  'punctuation',
  'invalid',
] as const;

export type TagName = (typeof TAG_NAMES)[number];

export interface TaggedToken {
  text: string;
  tag: TagName;
}

export function tokenTags(parser: LRParser, text: string): TaggedToken[] {
  const highlighter = tagHighlighter(
    TAG_NAMES.map((name) => ({ tag: (tags as Record<string, Tag>)[name], class: name }))
  );
  const out: TaggedToken[] = [];
  highlightTree(parser.parse(text), highlighter, (from, to, cls) => {
    out.push({ text: text.slice(from, to), tag: cls as TagName });
  });
  return out;
}

/** The tag given to the first token whose text is exactly `token`. */
export function tagOf(parser: LRParser, text: string, token: string): TagName | undefined {
  return tokenTags(parser, text).find((t) => t.text === token)?.tag;
}
