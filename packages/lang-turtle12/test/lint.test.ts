import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { LanguageSupport } from '@codemirror/language';
import { nquads, ntriples, parseErrors, parser, trig, turtle } from '../dist/index.js';
import { errorRanges, readCorpus } from '../../../test/harness';
import { stateFor } from '../../../test/editor';

const corpus = join(dirname(fileURLToPath(import.meta.url)), 'corpus');

describe('parseErrors', () => {
  it('reports nothing for a valid document', () => {
    expect(parseErrors(stateFor('<a> <b> <c> .\n', turtle()))).toEqual([]);
  });

  it('reports a missing full stop where the next statement starts', () => {
    expect(parseErrors(stateFor('<a> <b> <c>\n<d> <e> <f> .\n', turtle()))).toEqual([
      { from: 12, to: 12, message: 'Syntax error.' },
    ]);
  });

  it('keeps mistakes separated by a valid statement apart', () => {
    expect(parseErrors(stateFor('<a> <b> <c> . oops <d> <e> <f> . oops\n', turtle()))).toEqual([
      { from: 14, to: 18, message: 'Unexpected “oops”.' },
      { from: 33, to: 37, message: 'Unexpected “oops”.' },
    ]);
  });
});

describe('parseErrors agrees with the parser on the W3C corpus', () => {
  const groups: { group: string; top: string; language: () => LanguageSupport }[] = [
    { group: 'turtle12', top: 'TurtleDoc', language: turtle },
    { group: 'trig12', top: 'TrigDoc', language: trig },
    { group: 'ntriples12', top: 'NTriplesDoc', language: ntriples },
    { group: 'nquads12', top: 'NQuadsDoc', language: nquads },
  ];

  it.each(groups)('$group', ({ group, top, language }) => {
    const groupParser = parser.configure({ top });
    const disagreements = readCorpus(join(corpus, group)).filter((entry) => {
      const text = readFileSync(join(corpus, group, entry.file), 'utf8');
      return (errorRanges(groupParser, text).length > 0) !== (parseErrors(stateFor(text, language())).length > 0);
    });
    expect(disagreements.map((entry) => entry.name)).toEqual([]);
  });
});
