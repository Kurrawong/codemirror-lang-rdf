import { expect, test } from '@playwright/test';
import { mount, tagOf, tokens } from './helpers';

/**
 * Keyword colour, asserted on screen.
 *
 * The unit tests check that the grammar assigns `keyword` to `SELECT`. This
 * checks that a reader sees it: the tag reaches a `HighlightStyle`, the style
 * reaches the DOM, and the generated class actually paints. Between the tag and
 * the pixel sit CodeMirror's generated class names, which no CSS selector can
 * reach — the whole reason the tag table has to be right.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
});

test('one style colours all six languages the same way', async ({ page }) => {
  // N-Triples and N-Quads have no prefix mechanism, so `PREFIX` is only
  // expected in the four languages that have a prologue.
  const cases = [
    { id: 'ttl', language: 'turtle', prologue: true, doc: 'PREFIX ex: <http://e/>\nex:s ex:p "x"@en--ltr .' },
    { id: 'trig', language: 'trig', prologue: true, doc: 'PREFIX ex: <http://e/>\nex:g { ex:s ex:p "x"@en--ltr }' },
    { id: 'nt', language: 'ntriples', prologue: false, doc: '<http://s> <http://p> "x"@en--ltr .' },
    { id: 'nq', language: 'nquads', prologue: false, doc: '<http://s> <http://p> "x"@en--ltr <http://g> .' },
    { id: 'rq', language: 'sparql', prologue: true, doc: 'PREFIX ex: <http://e/>\nASK { ex:s ex:p "x"@en--ltr }' },
    {
      id: 'srl',
      language: 'srl',
      prologue: true,
      doc: 'PREFIX ex: <http://e/>\nRULE {} WHERE { ex:s ex:p "x"@en--ltr }',
    },
  ] as const;

  for (const { id, language, doc, prologue } of cases) {
    await mount(page, id, language, doc);
    if (prologue) expect(await tagOf(page, id, 'PREFIX'), `${language}: PREFIX`).toBe('keyword');
    expect(await tagOf(page, id, '@en--ltr'), `${language}: language tag`).toBe('annotation');
    expect(await tagOf(page, id, '"x"'), `${language}: string`).toBe('string');
    expect(await tagOf(page, id, '<http://p>') ?? (await tagOf(page, id, 'ex:p')), `${language}: predicate`)
      .toBeTruthy();
  }
});

test('SPARQL keywords are coloured, in any casing', async ({ page }) => {
  for (const kw of ['SELECT', 'select', 'SeLeCt']) {
    await mount(page, 'rq', 'sparql', `${kw} * { ?s ?p ?o }`);
    expect(await tagOf(page, 'rq', kw)).toBe('keyword');
  }
});

test('a keyword spelling used as a name is not coloured as a keyword', async ({ page }) => {
  await mount(page, 'rq', 'sparql', 'SELECT ?select { ?s select:p ?o }');
  expect(await tagOf(page, 'rq', 'SELECT')).toBe('keyword');
  expect(await tagOf(page, 'rq', '?select')).toBe('variableName');
  expect(await tagOf(page, 'rq', 'select:p')).toBe('namespace');
});

test('SRL keywords are coloured, which #157 is about', async ({ page }) => {
  /*
   * The bug this whole repository closes: an SRL document coloured by the
   * SPARQL 1.1 grammar left `RULE`, `SET`, `TUPLE` and `:=` uncoloured, and
   * read `:=` as an empty prefix.
   */
  await mount(
    page,
    'srl',
    'srl',
    'PREFIX ex: <http://e/>\nRULE ex:r { ex:s ex:p ?y }\nWHERE {\n  NOT DATA { ex:s ex:q ?x }\n  SET ( ?y := ?x + 1 )\n  TUPLE( ?x )\n}'
  );
  for (const kw of ['RULE', 'WHERE', 'NOT', 'DATA', 'SET', 'TUPLE'])
    expect(await tagOf(page, 'srl', kw), kw).toBe('keyword');
  expect(await tagOf(page, 'srl', ':=')).toBe('operator');
  // And the `:` of `:=` is not a prefix.
  expect((await tokens(page, 'srl')).filter((s) => s.text === ':')).toHaveLength(0);
});

test('the RDF 1.2 delimiters are coloured as braces', async ({ page }) => {
  await mount(page, 'ttl', 'turtle', 'PREFIX ex: <http://e/>\nex:s ex:p <<( ex:a ex:b ex:c )>> {| ex:q ex:r |} .');
  expect(await tagOf(page, 'ttl', '<<(')).toBe('brace');
  expect(await tagOf(page, 'ttl', ')>>')).toBe('brace');
  expect(await tagOf(page, 'ttl', '{|')).toBe('brace');
  expect(await tagOf(page, 'ttl', '|}')).toBe('brace');
});

test('a typo does not uncolour the rest of the document', async ({ page }) => {
  /*
   * The error-tolerance property, seen from the reader's side: this is what
   * makes a Lezer grammar usable while a document is being written, and what a
   * validating parser cannot offer.
   */
  await mount(page, 'ttl', 'turtle', 'PREFIX ex: <http://e/>\nex:s ex:p .\nex:a ex:b "still coloured" .');
  expect(await tagOf(page, 'ttl', '"still coloured"')).toBe('string');
  expect(await tagOf(page, 'ttl', 'ex:a')).toBe('namespace');
});

test('an unterminated string does not swallow the document', async ({ page }) => {
  await mount(page, 'rq', 'sparql', 'PREFIX ex: <http://e/>\nASK { ex:s ex:p "unterminated\n}');
  expect(await tagOf(page, 'rq', 'PREFIX')).toBe('keyword');
  expect(await tagOf(page, 'rq', 'ASK')).toBe('keyword');
});
