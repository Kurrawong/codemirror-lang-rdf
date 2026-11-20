/**
 * The checks every formatter is held to, over a vendored corpus: formatting
 * changes only whitespace, and formatting the output again changes nothing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LRParser } from '@lezer/lr';
import { parsesCleanly, readCorpus } from './harness';

export interface Formatted {
  text: string;
  error: { from: number; to: number; message: string } | null;
}

/** The named tokens of a parse with their text. Comments lose trailing spaces, as the formatter trims them. */
export function tokensOf(parser: LRParser, text: string): string[] {
  const out: string[] = [];
  parser.parse(text).iterate({
    enter: (node) => {
      if (node.node.firstChild || node.from === node.to) return;
      const token = text.slice(node.from, node.to);
      out.push(`${node.name} ${node.name === 'Comment' ? token.trimEnd() : token}`);
    },
  });
  return out;
}

/** Text with all whitespace removed, except inside comments, whose trailing spaces are dropped. */
const squeeze = (text: string) => text.replace(/[^\S\n]+\n/g, '\n').replace(/\s+/g, '');

export interface Problem {
  file: string;
  problem: string;
}

/** Every positive document in `dir` that `parser` accepts, and what went wrong formatting it. */
export function checkCorpus(parser: LRParser, dir: string, format: (text: string) => Formatted): { checked: number; problems: Problem[] } {
  const problems: Problem[] = [];
  let checked = 0;
  for (const entry of readCorpus(dir)) {
    if (entry.expect !== 'positive') continue;
    const input = readFileSync(join(dir, entry.file), 'utf8');
    if (!parsesCleanly(parser, input)) continue;
    checked++;
    const first = format(input);
    if (first.error) {
      problems.push({ file: entry.file, problem: `error: ${first.error.message}` });
      continue;
    }
    if (squeeze(first.text) !== squeeze(input)) problems.push({ file: entry.file, problem: 'changed more than whitespace' });
    else if (tokensOf(parser, first.text).join('\n') !== tokensOf(parser, input).join('\n'))
      problems.push({ file: entry.file, problem: 'tokens differ' });
    const second = format(first.text);
    if (second.text !== first.text) problems.push({ file: entry.file, problem: 'not idempotent' });
  }
  return { checked, problems };
}
