import { expect, test } from '@playwright/test';
import { diagnostics, mount, tagOf } from './helpers';

/**
 * Parse errors as the reader sees them, from the linter each language support
 * includes: an underline over unexpected text, a point marker where a token is
 * missing.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
});

test('unexpected SPARQL text is underlined', async ({ page }) => {
  await mount(page, 'rq', 'sparql', 'SELECT * WHERE { ?s ?p ?o ) }');
  expect(await diagnostics(page, 'rq')).toEqual({
    found: [{ from: 26, to: 27, message: 'Unexpected “)”.' }],
    marks: 1,
  });
});

test('a valid document has no marks', async ({ page }) => {
  await mount(page, 'rq', 'sparql', 'SELECT * WHERE { ?s ?p ?o }');
  expect(await diagnostics(page, 'rq')).toEqual({ found: [], marks: 0 });
});

test('Turtle, TriG, N-Triples and N-Quads underline parse errors', async ({ page }) => {
  for (const language of ['turtle', 'trig', 'ntriples', 'nquads'] as const) {
    await mount(page, 'rdf', language, '<http://s> <http://p> <http://o> . oops\n');
    expect((await diagnostics(page, 'rdf')).found, language).toEqual([
      { from: 35, to: 39, message: 'Unexpected “oops”.' },
    ]);
  }
});

test('a missing token gets a point marker', async ({ page }) => {
  await mount(page, 'rq', 'sparql', 'SELECT * WHERE { ?s ?p ?o\n');
  expect(await diagnostics(page, 'rq')).toEqual({
    found: [{ from: 26, to: 26, message: 'Syntax error.' }],
    marks: 1,
  });
});

test('stray words in SRL get one underline', async ({ page }) => {
  await mount(page, 'srl', 'srl', 'this is a test\nRULE { ?s <http://p> ?o } WHERE { ?s <http://q> ?o }');
  expect(await diagnostics(page, 'srl')).toEqual({
    found: [{ from: 0, to: 14, message: 'Unexpected “this is a test”.' }],
    marks: 1,
  });
});

test('an SRL conformance error and a parse error do not underline the same text', async ({ page }) => {
  await mount(page, 'srl', 'srl', 'PREFIX ex: <http://example.org/>\nCONSTRUCT { ?s ex:p ?o } WHERE { ?s ex:q ?o }\n');
  const { found } = await diagnostics(page, 'srl');
  expect(found.length).toBeGreaterThan(0);
  const overlapping = found.filter((a, i) => found.some((b, j) => i !== j && a.from < b.to && b.from < a.to));
  expect(overlapping).toEqual([]);
});

test('a document with an error mark is still coloured', async ({ page }) => {
  await mount(page, 'ttl', 'turtle', 'PREFIX ex: <http://e/>\nex:s ex:p .\nex:a ex:b "still coloured" .');
  expect((await diagnostics(page, 'ttl')).marks).toBeGreaterThan(0);
  expect(await tagOf(page, 'ttl', '"still coloured"')).toBe('string');
  expect(await tagOf(page, 'ttl', 'ex:a')).toBe('namespace');
});
