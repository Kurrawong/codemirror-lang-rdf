import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EditorState } from '@codemirror/state';
import { formatSrl, formatSrlDocument, parser, srl } from '../dist/index.js';
import { checkCorpus } from '../../../test/format';
import { readCorpus } from '../../../test/harness';

const here = dirname(fileURLToPath(import.meta.url));

describe('formatting the SPARQL-RL syntax suite', () => {
  const dir = join(here, 'corpus', 'srl-syntax');
  const files = readCorpus(dir)
    .filter((e) => e.expect === 'positive')
    .map((e) => e.file);
  const { checked, problems } = checkCorpus(parser, dir, files, (text) => formatSrl(text));

  it('checks some documents', () => expect(checked).toBeGreaterThan(10));
  it('changes only whitespace and is idempotent', () => expect(problems).toEqual([]));
});

describe('formatSrl', () => {
  it('lays out rules, data blocks, negation, assignments and aggregates', () => {
    const result = formatSrl(
      'PREFIX ex: <http://e/> RULE ex:r { ?s ex:p ?o . TUPLE(?s, ?o) } WHERE { ?s ex:q ?o NOT { ?o a ex:C } SET(?z := ?o + 1) GROUP BY ?s { ?s ex:v ?v } [ ?n := COUNT(*) , ?m := MAX(?v) ] } DATA { ex:a ex:b ex:c }',
    );
    expect(result.error).toBeNull();
    expect(result.text).toBe(
      [
        'PREFIX ex: <http://e/>',
        'RULE ex:r {',
        '  ?s ex:p ?o .',
        '  TUPLE(?s, ?o)',
        '}',
        'WHERE {',
        '  ?s ex:q ?o',
        '  NOT {',
        '    ?o a ex:C',
        '  }',
        '  SET(?z := ?o + 1)',
        '  GROUP BY ?s {',
        '    ?s ex:v ?v',
        '  } [ ?n := COUNT(*), ?m := MAX(?v) ]',
        '}',
        'DATA {',
        '  ex:a ex:b ex:c',
        '}',
      ].join('\n'),
    );
  });

  it('returns a document with a parse error unchanged', () => {
    expect(formatSrl('RULE { ?s ?p ?o }').error).not.toBeNull();
  });
});

describe('formatSrlDocument', () => {
  it('formats an SRL editor', () => {
    let state = EditorState.create({ doc: 'RULE { ?s ex:p ?o } WHERE { ?o ex:q ?s }', extensions: [srl()] });
    expect(formatSrlDocument({ state, dispatch: (tr) => (state = tr.state) })).toBe(true);
    expect(state.doc.toString()).toBe('RULE {\n  ?s ex:p ?o\n}\nWHERE {\n  ?o ex:q ?s\n}');
  });
});
