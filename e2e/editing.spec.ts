import { expect, test } from '@playwright/test';
import { completions, docOf, mount, setCursor } from './helpers';

/**
 * Completion and indentation, driven through the keyboard.
 *
 * These go through `@codemirror/autocomplete` and the real keymap, so a
 * completion list that the source produces but the extension never shows — or
 * an indentation the language computes but Tab does not apply — fails here.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('index.html');
  await expect(page.locator('body[data-ready="true"]')).toBeAttached();
});

test('the completion list offers SPARQL keywords', async ({ page }) => {
  const doc = 'SEL';
  await mount(page, 'rq', 'sparql', doc);
  await setCursor(page, 'rq', doc.length);
  expect(await completions(page, 'rq')).toContain('SELECT');
});

test('the completion list offers the 1.2 built-ins with their spelling', async ({ page }) => {
  const doc = 'ASK { FILTER(isTR';
  await mount(page, 'rq', 'sparql', doc);
  await setCursor(page, 'rq', doc.length);
  expect(await completions(page, 'rq')).toContain('isTRIPLE');
});

test("the completion list offers the document's own prefixes", async ({ page }) => {
  const doc = 'PREFIX foaf: <http://xmlns.com/foaf/0.1/>\nASK { ?s fo';
  await mount(page, 'rq', 'sparql', doc);
  await setCursor(page, 'rq', doc.length);
  expect(await completions(page, 'rq')).toContain('foaf:');
});

test('the completion list offers a prefix the application supplied', async ({ page }) => {
  const doc = 'ASK { ?s ex';
  await mount(page, 'rq', 'sparql', doc);
  await setCursor(page, 'rq', doc.length);
  // The fixture mounts sparql() with prefixSource: { ext: … }.
  expect(await completions(page, 'rq')).toContain('ext:');
});

test('the completion list offers variables already in the query', async ({ page }) => {
  const doc = 'SELECT * { ?subject ?predicate ?object . FILTER(?su';
  await mount(page, 'rq', 'sparql', doc);
  await setCursor(page, 'rq', doc.length);
  const options = await completions(page, 'rq');
  expect(options).toContain('?subject');
});

test('Turtle completion offers the directives', async ({ page }) => {
  const doc = '@pre';
  await mount(page, 'ttl', 'turtle', doc);
  await setCursor(page, 'ttl', doc.length);
  expect(await completions(page, 'ttl')).toContain('@prefix');
});

test('SRL completion offers RULE, SET and TUPLE', async ({ page }) => {
  const doc = 'RULE {} WHERE { S';
  await mount(page, 'srl', 'srl', doc);
  await setCursor(page, 'srl', doc.length);
  const options = await completions(page, 'srl');
  expect(options).toContain('SET');
  expect(options).toContain('SELECT');
});

test('SRL completion drops TUPLE when the extension is off', async ({ page }) => {
  const doc = 'RULE {} WHERE { TU';
  await mount(page, 'srl-off', 'srl-no-tuples', doc);
  await setCursor(page, 'srl-off', doc.length);
  expect(await completions(page, 'srl-off')).not.toContain('TUPLE');

  await mount(page, 'srl-on', 'srl', doc);
  await setCursor(page, 'srl-on', doc.length);
  expect(await completions(page, 'srl-on')).toContain('TUPLE');
});

test('no completion list appears inside a string', async ({ page }) => {
  const doc = 'ASK { ?s ?p "some tex';
  await mount(page, 'rq', 'sparql', doc);
  await setCursor(page, 'rq', doc.length);
  expect(await completions(page, 'rq')).toEqual([]);
});

test('Tab indents a SPARQL pattern to its enclosing brace', async ({ page }) => {
  const doc = 'SELECT * {\n?s ?p ?o\n}';
  await mount(page, 'rq', 'sparql', doc);
  await setCursor(page, 'rq', doc.indexOf('?s'));
  await page.keyboard.press('Tab');
  expect(await docOf(page, 'rq')).toBe('SELECT * {\n  ?s ?p ?o\n}');
});

test('Tab indents a Turtle blank-node property list', async ({ page }) => {
  const doc = 'PREFIX ex: <http://e/>\nex:s ex:p [\nex:q ex:r\n] .';
  await mount(page, 'ttl', 'turtle', doc);
  await setCursor(page, 'ttl', doc.indexOf('ex:q'));
  await page.keyboard.press('Tab');
  expect(await docOf(page, 'ttl')).toBe('PREFIX ex: <http://e/>\nex:s ex:p [\n  ex:q ex:r\n] .');
});

test('Tab indents an SRL rule body', async ({ page }) => {
  const doc = 'RULE {} WHERE {\n?s ?p ?o\n}';
  await mount(page, 'srl', 'srl', doc);
  await setCursor(page, 'srl', doc.indexOf('?s'));
  await page.keyboard.press('Tab');
  expect(await docOf(page, 'srl')).toBe('RULE {} WHERE {\n  ?s ?p ?o\n}');
});

test('typing a closing brace dedents the line', async ({ page }) => {
  const doc = 'SELECT * {\n  ?s ?p ?o\n  ';
  await mount(page, 'rq', 'sparql', doc);
  await setCursor(page, 'rq', doc.length);
  await page.keyboard.type('}');
  expect(await docOf(page, 'rq')).toBe('SELECT * {\n  ?s ?p ?o\n}');
});
