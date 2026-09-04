import { expect, test } from '@playwright/test';
import { foldAt, foldGutterMarkers, mount, unfoldAll, visibleText } from './helpers';

/**
 * Folding, through the real fold gutter.
 *
 * The unit tests ask `foldable()` what range it would hide. These click the
 * gutter and check what is left on screen, which is the only way to see that
 * the range CodeMirror actually folds is the one the grammar meant.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
});

test('a Turtle blank-node property list folds to one line', async ({ page }) => {
  await mount(page, 'ttl', 'turtle', 'PREFIX ex: <http://e/>\nex:s ex:p [\n  ex:q ex:r ;\n  ex:q2 ex:r2\n] .');
  expect(await foldGutterMarkers(page, 'ttl')).toEqual([2]);

  expect(await foldAt(page, 'ttl', 2)).toBe(true);
  const folded = await visibleText(page, 'ttl');
  expect(folded).not.toContain('ex:q2');
  expect(folded).toContain('ex:s ex:p [');
  expect(folded).toContain('] .');

  await unfoldAll(page, 'ttl');
  expect(await visibleText(page, 'ttl')).toContain('ex:q2');
});

test('a TriG graph block folds', async ({ page }) => {
  await mount(page, 'trig', 'trig', 'PREFIX ex: <http://e/>\nex:g {\n  ex:s ex:p ex:o .\n}');
  expect(await foldAt(page, 'trig', 2)).toBe(true);
  const folded = await visibleText(page, 'trig');
  expect(folded).not.toContain('ex:s ex:p ex:o');
  expect(folded).toContain('ex:g {');
});

test('a Turtle statement folds from the end of its first line', async ({ page }) => {
  // The one Turtle fold with no brackets around it.
  await mount(page, 'ttl', 'turtle', 'PREFIX ex: <http://e/>\nex:s\n  ex:p ex:o ;\n  ex:p2 ex:o2 .');
  expect(await foldAt(page, 'ttl', 2)).toBe(true);
  const folded = await visibleText(page, 'ttl');
  expect(folded).toContain('ex:s');
  expect(folded).not.toContain('ex:p2');
});

test('a SPARQL group graph pattern folds, and its nested pattern folds separately', async ({ page }) => {
  await mount(page, 'rq', 'sparql', 'SELECT * {\n  OPTIONAL {\n    ?s ?p ?o\n  }\n}');
  expect(await foldGutterMarkers(page, 'rq')).toEqual([1, 2]);

  expect(await foldAt(page, 'rq', 2)).toBe(true);
  let folded = await visibleText(page, 'rq');
  expect(folded).not.toContain('?s ?p ?o');
  expect(folded).toContain('OPTIONAL {');
  expect(folded).toContain('SELECT * {');

  await unfoldAll(page, 'rq');
  expect(await foldAt(page, 'rq', 1)).toBe(true);
  folded = await visibleText(page, 'rq');
  expect(folded).toContain('SELECT * {');
  expect(folded).not.toContain('OPTIONAL');
});

test('an SRL rule folds per head, per body and per DATA block', async ({ page }) => {
  await mount(
    page,
    'srl',
    'srl',
    'PREFIX ex: <http://e/>\nRULE {\n  ex:s ex:p ?y\n}\nWHERE {\n  ex:s ex:q ?y\n}\nDATA {\n  ex:s ex:q 1\n}'
  );
  expect(await foldGutterMarkers(page, 'srl')).toEqual([2, 5, 8]);

  expect(await foldAt(page, 'srl', 2)).toBe(true);
  expect(await foldAt(page, 'srl', 5)).toBe(true);
  expect(await foldAt(page, 'srl', 8)).toBe(true);
  const folded = await visibleText(page, 'srl');
  expect(folded).not.toContain('ex:s ex:p ?y');
  expect(folded).not.toContain('ex:s ex:q ?y');
  expect(folded).not.toContain('ex:s ex:q 1');
  expect(folded).toContain('RULE {');
  expect(folded).toContain('WHERE {');
  expect(folded).toContain('DATA {');
});

test('N-Triples offers no folds, having no nesting', async ({ page }) => {
  await mount(page, 'nt', 'ntriples', '<http://s> <http://p> <http://o> .\n<http://a> <http://b> <http://c> .');
  expect(await foldGutterMarkers(page, 'nt')).toEqual([]);
});

test('a document with a typo still folds the blocks around it', async ({ page }) => {
  await mount(page, 'rq', 'sparql', 'SELECT * {\n  ?s ?p\n}\nGROUP BY ?s');
  expect(await foldAt(page, 'rq', 1)).toBe(true);
  const folded = await visibleText(page, 'rq');
  expect(folded).toContain('GROUP BY ?s');
  expect(folded).not.toContain('?s ?p\n');
});
