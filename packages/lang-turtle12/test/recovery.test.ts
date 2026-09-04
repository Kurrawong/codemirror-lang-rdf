import { describe, expect, it } from 'vitest';
import { parser } from '../dist/index.js';
import { errorRanges, parsesCleanly } from '../../../test/harness';

/**
 * Error recovery is a tested property, not a hope.
 *
 * The editor's job is to keep colouring a document that is mid-edit, and a
 * document is mid-edit most of the time it is being read. So a typo must be
 * contained: the statements after it must still parse into real nodes, which is
 * what "recovers at a statement boundary" means in practice.
 */
const turtle = parser.configure({ top: 'TurtleDoc' });
const trig = parser.configure({ top: 'TrigDoc' });

/** The names of the nodes covering `text`'s last statement. */
function namesAfter(p: ReturnType<typeof parser.configure>, text: string, from: number): string[] {
  const names: string[] = [];
  p.parse(text).iterate({
    from,
    to: text.length,
    enter: (n) => {
      names.push(n.name);
    },
  });
  return names;
}

describe('recovery at Turtle statement boundaries', () => {
  it('contains a broken statement to itself', () => {
    const good = 'ex:a ex:b ex:c .\n';
    const broken = 'ex:s ex:p .\n';
    const text = broken + good;
    expect(parsesCleanly(turtle, text)).toBe(false);
    // The statement after the error is a real Triples node, not error debris.
    expect(namesAfter(turtle, text, broken.length)).toContain('Triples');
  });

  it('keeps colouring after an unterminated statement', () => {
    const text = 'ex:s ex:p ex:o\nex:a ex:b ex:c .\n';
    expect(namesAfter(turtle, text, text.indexOf('ex:a'))).toContain('PredicateObjectList');
  });

  it('keeps colouring after an unknown directive', () => {
    const text = '@nonsense ex: <http://e/> .\nex:a ex:b ex:c .\n';
    expect(parsesCleanly(turtle, text)).toBe(false);
    expect(namesAfter(turtle, text, text.indexOf('ex:a'))).toContain('Triples');
  });

  it('accepts an empty slot in a predicate-object list', () => {
    // Turtle [7] allows a `;` with nothing after it, so this is not a typo.
    expect(parsesCleanly(turtle, 'ex:s ex:p ex:o ; ; ex:p2 ex:o2 .\n')).toBe(true);
  });

  it('recovers inside a predicate-object list', () => {
    const text = 'ex:s ex:p ex:o ; "notaverb" ex:o2 ; ex:p2 ex:o2 .\n';
    expect(parsesCleanly(turtle, text)).toBe(false);
    expect(namesAfter(turtle, text, text.indexOf('ex:p2'))).toContain('Verb');
  });

  it('reports at most one error region per typo', () => {
    // A single missing object should not cascade into the rest of the document.
    const text = 'ex:s ex:p .\nex:a ex:b ex:c .\nex:d ex:e ex:f .\n';
    expect(errorRanges(turtle, text).length).toBeLessThanOrEqual(2);
  });
});

describe('recovery at TriG block boundaries', () => {
  it('contains a broken graph block to itself', () => {
    const text = 'ex:g1 { ex:s ex:p }\nex:g2 { ex:a ex:b ex:c }\n';
    expect(parsesCleanly(trig, text)).toBe(false);
    expect(namesAfter(trig, text, text.indexOf('ex:g2'))).toContain('WrappedGraph');
  });

  it('survives an unclosed graph block', () => {
    const text = 'ex:g1 { ex:s ex:p ex:o .\n';
    const names = namesAfter(trig, text, 0);
    expect(names).toContain('WrappedGraph');
    expect(parsesCleanly(trig, text)).toBe(false);
  });
});

describe('an empty document is not an error', () => {
  it.each([
    ['TurtleDoc', ''],
    ['TrigDoc', ''],
    ['NTriplesDoc', ''],
    ['NQuadsDoc', ''],
    ['TurtleDoc', '# just a comment\n'],
  ])('%s: %j', (top, text) => {
    expect(parsesCleanly(parser.configure({ top }), text)).toBe(true);
  });
});
