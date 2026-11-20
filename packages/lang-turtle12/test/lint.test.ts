import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { LanguageSupport } from '@codemirror/language';
import { nquads, ntriples, parseErrors, parser, trig, turtle } from '../dist/index.js';
import { errorRanges, readW3cCorpus } from '../../../test/harness';
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
  const languages: Record<string, { top: string; language: () => LanguageSupport }> = {
    turtle: { top: 'TurtleDoc', language: turtle },
    trig: { top: 'TrigDoc', language: trig },
    ntriples: { top: 'NTriplesDoc', language: ntriples },
    nquads: { top: 'NQuadsDoc', language: nquads },
  };

  it.each(Object.keys(languages))('%s', (lang) => {
    const { top, language } = languages[lang];
    const langParser = parser.configure({ top });
    const disagreements = readW3cCorpus(corpus)
      .filter((entry) => entry.lang === lang)
      .filter((entry) => {
        const text = readFileSync(join(corpus, entry.file), 'utf8');
        return (errorRanges(langParser, text).length > 0) !== (parseErrors(stateFor(text, language())).length > 0);
      });
    expect(disagreements.map((entry) => entry.file)).toEqual([]);
  });
});
