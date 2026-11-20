import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { EditorState } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import { formatTurtle, formatTurtleDocument, parser, trig, turtle } from '../dist/index.js';
import { checkCorpus } from '../../../test/format';
import { readW3cCorpus } from '../../../test/harness';

const corpus = join(dirname(fileURLToPath(import.meta.url)), 'corpus');

describe.each([
  { dialect: 'turtle', top: 'TurtleDoc' },
  { dialect: 'trig', top: 'TrigDoc' },
] as const)('formatting the $dialect files of the W3C rdf-tests corpus', ({ dialect, top }) => {
  const files = readW3cCorpus(corpus)
    .filter((e) => e.lang === dialect && e.expect === 'positive')
    .map((e) => e.file);
  const { checked, problems } = checkCorpus(parser.configure({ top }), corpus, files, (text) => formatTurtle(text, { dialect }));

  it('checks some documents', () => expect(checked).toBeGreaterThan(10));
  it('changes only whitespace and is idempotent', () => expect(problems).toEqual([]));
});

const format = (text: string, dialect: 'turtle' | 'trig' = 'turtle') => {
  const result = formatTurtle(text, { dialect });
  expect(result.error).toBeNull();
  return result.text;
};

describe('formatTurtle', () => {
  it('puts each directive and subject on its own line and indents lists', () => {
    expect(format('@prefix ex: <http://e/> . PREFIX x: <http://x/>\nex:s a ex:C ; ex:p "a"@en , "b"^^ex:t . ex:t ex:p 1.0 .\n')).toBe(
      [
        '@prefix ex: <http://e/> .',
        'PREFIX x: <http://x/>',
        'ex:s a ex:C ;',
        '  ex:p "a"@en,',
        '    "b"^^ex:t .',
        'ex:t ex:p 1.0 .',
        '',
      ].join('\n'),
    );
  });

  it('keeps a blank node property list inline unless its content breaks', () => {
    expect(format('ex:s ex:p [ ex:q ex:r ] .')).toBe('ex:s ex:p [ ex:q ex:r ] .');
    expect(format('ex:s ex:p [ ex:q ex:r ; ex:t ( 1 2 ) ] .')).toBe(
      ['ex:s ex:p [', '  ex:q ex:r ;', '  ex:t ( 1 2 )', '] .'].join('\n'),
    );
  });

  it('keeps comments, trailing or on their own line, and one blank line', () => {
    expect(format('ex:s ex:p ex:o ;   # trailing\n\n\n  # own line\n ex:q ex:r .')).toBe(
      ['ex:s ex:p ex:o ; # trailing', '', '  # own line', '  ex:q ex:r .'].join('\n'),
    );
  });

  it('keeps RDF 1.2 reifiers, triple terms and annotations', () => {
    expect(format('<< ex:a ex:b ex:c ~ ex:r >> ex:p <<( ex:x ex:y ex:z )>> {| ex:q ex:w |} .')).toBe(
      '<< ex:a ex:b ex:c ~ex:r >> ex:p <<( ex:x ex:y ex:z )>> {| ex:q ex:w |} .',
    );
  });

  it('indents the statements of a TriG graph block', () => {
    expect(format('GRAPH ex:g { ex:s ex:p ex:o . ex:t ex:p ex:o } ex:h { }', 'trig')).toBe(
      ['GRAPH ex:g {', '  ex:s ex:p ex:o .', '  ex:t ex:p ex:o', '}', 'ex:h { }'].join('\n'),
    );
  });

  it('uses the indent it is given', () => {
    expect(formatTurtle('ex:s ex:p ex:o ; ex:q ex:r .', { indent: '\t' }).text).toBe('ex:s ex:p ex:o ;\n\tex:q ex:r .');
  });

  it('returns a document with a parse error unchanged and reports where', () => {
    const result = formatTurtle('ex:s ex:p  .');
    expect(result.text).toBe('ex:s ex:p  .');
    expect(result.changes).toEqual([]);
    expect(result.error?.from).toBe(11);
  });

  it('reads a GRAPH block as an error in Turtle', () => {
    expect(formatTurtle('GRAPH ex:g { ex:s ex:p ex:o }').error).not.toBeNull();
  });
});

describe('formatTurtleDocument', () => {
  it('formats the document with the editor indent unit', () => {
    let state = EditorState.create({ doc: 'ex:s ex:p ex:o ; ex:q ex:r .', extensions: [turtle(), indentUnit.of('    ')] });
    const handled = formatTurtleDocument({ state, dispatch: (tr) => (state = tr.state) });
    expect(handled).toBe(true);
    expect(state.doc.toString()).toBe('ex:s ex:p ex:o ;\n    ex:q ex:r .');
  });

  it('parses with TriG in a TriG editor', () => {
    let state = EditorState.create({ doc: 'GRAPH ex:g { ex:s ex:p ex:o }', extensions: [trig()] });
    expect(formatTurtleDocument({ state, dispatch: (tr) => (state = tr.state) })).toBe(true);
    expect(state.doc.toString()).toBe('GRAPH ex:g {\n  ex:s ex:p ex:o\n}');
  });

  it('declines a document with a parse error', () => {
    const state = EditorState.create({ doc: 'ex:s ex:p .', extensions: [turtle()] });
    expect(formatTurtleDocument({ state, dispatch: () => expect.unreachable() })).toBe(false);
  });
});
