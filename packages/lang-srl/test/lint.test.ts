import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseErrors, parser, srl } from '../dist/index.js';
import { errorRanges, readCorpus } from '../../../test/harness';
import { stateFor } from '../../../test/editor';

const corpus = join(dirname(fileURLToPath(import.meta.url)), 'corpus');

describe('parseErrors', () => {
  it('merges stray words before a rule into one error', () => {
    const doc = 'this is a test\nPREFIX ex: <http://example.org/>\nRULE { ?s ex:p ?o } WHERE { ?s ex:q ?o }\n';
    expect(parseErrors(stateFor(doc, srl()))).toEqual([{ from: 0, to: 14, message: 'Unexpected “this is a test”.' }]);
  });
});

describe('parseErrors agrees with the parser on the W3C corpus', () => {
  it('srl-syntax', () => {
    const group = 'srl-syntax';
    const disagreements = readCorpus(join(corpus, group)).filter((entry) => {
      const text = readFileSync(join(corpus, group, entry.file), 'utf8');
      return (errorRanges(parser, text).length > 0) !== (parseErrors(stateFor(text, srl())).length > 0);
    });
    expect(disagreements.map((entry) => entry.name)).toEqual([]);
  });
});
