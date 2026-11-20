#!/usr/bin/env node
/**
 * Vendor the W3C test suites into the packages that test against them.
 *
 * The corpus is committed, not fetched at test time: CI must not depend on
 * github.com being up, and a corpus that can change under a green build is not
 * a conformance guarantee. The pin lives in `corpus.config.json` and is written
 * into a `SOURCE` file in each package's corpus.
 *
 * What is vendored is decided by upstream, not by a list kept here. The script
 * starts at the root manifests in `config.roots`, follows every `mf:include`,
 * and takes every file that any test entry references:
 *
 * - The `mf:action` of a negative syntax test must not parse.
 * - Every other referenced file must parse: positive syntax tests, but also the
 *   queries, updates and data of evaluation tests and the expected results of
 *   RDF evaluation tests. An evaluation test is only meaningful on valid input,
 *   so its files are positive syntax tests that upstream does not label as such.
 *
 * A file's language comes from its test type for an `mf:action`, and otherwise
 * from its extension. A test type or extension the config does not list stops
 * the run, so a new kind of upstream test is noticed instead of skipped.
 *
 * Usage:
 *   node scripts/vendor-corpus.mjs                 # clone the pinned revision
 *   node scripts/vendor-corpus.mjs --from <path>   # use an existing checkout
 *   node scripts/vendor-corpus.mjs --update        # re-pin to upstream HEAD
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Parser, Store } from 'n3';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'corpus.config.json'), 'utf8'));

const args = process.argv.slice(2);
const fromIndex = args.indexOf('--from');
const update = args.includes('--update');
const providedCheckout = fromIndex >= 0 ? resolve(args[fromIndex + 1]) : null;

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const MF = 'http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#';
const PREFIXES = {
  mf: MF,
  rdft: 'http://www.w3.org/ns/rdftest#',
};
const APPROVAL = ['http://www.w3.org/ns/rdftest#approval', 'http://www.w3.org/2001/sw/DataAccess/tests/test-dawg#approval'];

function compact(iri) {
  for (const [prefix, ns] of Object.entries(PREFIXES)) if (iri.startsWith(ns)) return `${prefix}:${iri.slice(ns.length)}`;
  return iri;
}

function rdfList(store, head) {
  const items = [];
  while (head && head.value !== `${RDF}nil`) {
    items.push(store.getObjects(head, `${RDF}first`, null)[0]);
    head = store.getObjects(head, `${RDF}rest`, null)[0];
  }
  return items;
}

/**
 * Every local file reachable from `node` through blank nodes, such as both
 * files in `[ qt:query <q.rq> ; qt:data <d.ttl> ]`. Vocabulary IRIs such as
 * `ut:success` are not files and are left out.
 */
function referencedIris(store, node, seen = new Set()) {
  if (node.termType === 'NamedNode') return node.value.startsWith('file:') ? [node.value] : [];
  if (node.termType !== 'BlankNode' || seen.has(node.value)) return [];
  seen.add(node.value);
  return store.getQuads(node, null, null, null).flatMap((q) => referencedIris(store, q.object, seen));
}

function languageOf(file) {
  const ext = extname(file);
  if (config.extensions[ext]) return config.extensions[ext];
  if (config.ignoredExtensions.includes(ext)) return null;
  throw new Error(`unknown extension ${ext} on ${file}: add it to "extensions" or "ignoredExtensions"`);
}

/**
 * Walk the manifest tree and return one record per (file, language).
 *
 * A file referenced by several entries is one record listing every entry. A
 * file that one entry says must parse and another says must not is an error.
 */
function collect(checkout) {
  const records = new Map();
  const visited = new Set();
  const skipped = [];
  const toPath = (url) => relative(checkout, fileURLToPath(url));

  const add = (url, lang, expect, group, test) => {
    const file = toPath(url);
    if (file.startsWith('..')) throw new Error(`${test} references a file outside the checkout: ${url}`);
    if (!existsSync(join(checkout, file))) throw new Error(`${test} references a missing file: ${file}`);
    const key = `${lang} ${file}`;
    const record = records.get(key) ?? { file, lang, expect, group, tests: [] };
    if (record.expect !== expect) throw new Error(`${file} is ${record.expect} for ${record.tests[0]} but ${expect} for ${test}`);
    record.tests.push(test);
    records.set(key, record);
  };

  const visit = (url) => {
    if (visited.has(url)) return;
    visited.add(url);
    const store = new Store(new Parser({ baseIRI: url }).parse(readFileSync(fileURLToPath(url), 'utf8')));
    const group = dirname(toPath(url));
    const manifests = store.getSubjects(`${RDF}type`, `${MF}Manifest`, null);
    if (manifests.length === 0) throw new Error(`no mf:Manifest in ${toPath(url)}`);
    for (const manifest of manifests) {
      for (const list of store.getObjects(manifest, `${MF}include`, null)) {
        for (const included of rdfList(store, list)) visit(included.value);
      }
      for (const list of store.getObjects(manifest, `${MF}entries`, null)) {
        for (const entry of rdfList(store, list)) {
          const test = `${group}#${entry.value.replace(/^.*#/, '')}`;
          const types = store.getObjects(entry, `${RDF}type`, null).map((t) => compact(t.value));
          if (types.length !== 1) throw new Error(`${test} has ${types.length} rdf:type values`);
          const type = config.testTypes[types[0]];
          if (!type) throw new Error(`${test} has unknown type ${types[0]}: add it to "testTypes"`);
          const approval = APPROVAL.flatMap((p) => store.getObjects(entry, p, null)).map((a) => a.value.replace(/^.*#/, ''));
          if (approval.some((a) => config.skippedApprovals.includes(a))) {
            skipped.push(`${test} (${approval.join(', ')})`);
            continue;
          }
          for (const action of store.getObjects(entry, `${MF}action`, null)) {
            if (action.termType === 'NamedNode' && type.lang) {
              add(action.value, type.lang, type.expect, group, test);
              continue;
            }
            for (const iri of referencedIris(store, action)) {
              const lang = languageOf(iri);
              if (lang) add(iri, lang, 'positive', group, test);
            }
          }
          // A negative test has no result; for every other type the expected
          // output, where it is RDF or SPARQL text, must parse too.
          for (const result of store.getObjects(entry, `${MF}result`, null)) {
            for (const iri of referencedIris(store, result)) {
              const lang = languageOf(iri);
              if (lang) add(iri, lang, 'positive', group, test);
            }
          }
        }
      }
    }
  };

  for (const start of config.roots) visit(pathToFileURL(join(checkout, start)).href);
  return { records: [...records.values()], manifests: visited.size, skipped };
}

function gitCheckout() {
  if (providedCheckout) return { path: providedCheckout, owned: false };
  const dir = mkdtempSync(join(tmpdir(), 'rdf-tests-'));
  console.log(`cloning ${config.source.url} …`);
  execFileSync('git', ['clone', '--quiet', '--filter=blob:none', config.source.url, dir], { stdio: 'inherit' });
  if (!update) execFileSync('git', ['-C', dir, 'checkout', '--quiet', config.source.commit]);
  return { path: dir, owned: true };
}

const checkout = gitCheckout();
try {
  const head = execFileSync('git', ['-C', checkout.path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!update && head !== config.source.commit && !providedCheckout) {
    throw new Error(`checkout is at ${head}, expected ${config.source.commit}`);
  }

  const { records, manifests, skipped } = collect(checkout.path);
  const byPackage = new Map();
  for (const record of records) {
    const dest = config.packages[record.lang];
    if (!byPackage.has(dest)) byPackage.set(dest, []);
    byPackage.get(dest).push(record);
  }

  for (const [dest, entries] of byPackage) {
    const corpus = join(root, dest);
    // Only the upstream trees are replaced; expected-fail.json sits beside them.
    for (const top of new Set(entries.map((e) => e.file.split('/')[0]))) rmSync(join(corpus, top), { recursive: true, force: true });
    for (const entry of entries) {
      mkdirSync(join(corpus, dirname(entry.file)), { recursive: true });
      cpSync(join(checkout.path, entry.file), join(corpus, entry.file));
    }
    entries.sort((a, b) => a.group.localeCompare(b.group) || a.file.localeCompare(b.file) || a.lang.localeCompare(b.lang));
    writeFileSync(join(corpus, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`);
    const positive = entries.filter((e) => e.expect === 'positive').length;
    writeFileSync(
      join(corpus, 'SOURCE'),
      [
        config.source.url,
        `commit: ${head}`,
        `roots: ${config.roots.join(', ')}`,
        `manifests read: ${manifests}`,
        `entries: ${positive} positive, ${entries.length - positive} negative`,
        `tests skipped for their approval status: ${skipped.length}`,
        ...skipped.map((s) => `  ${s}`),
        '',
        'Vendored by scripts/vendor-corpus.mjs. Do not edit by hand.',
        'Licensed under the W3C Test Suite License and the W3C 3-clause BSD License.',
        '',
      ].join('\n')
    );
    console.log(`${dest}: ${entries.length} entries (${positive} positive)`);
  }
  // Re-pinned last, so a run that fails part-way leaves the pin unchanged.
  if (update) {
    // A text replacement, so the rest of the file keeps its hand formatting.
    const file = join(root, 'corpus.config.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace(`"commit": "${config.source.commit}"`, `"commit": "${head}"`));
    console.log(`re-pinned to ${head}`);
  }
  if (skipped.length) console.log(`skipped for approval status: ${skipped.join('; ')}`);
} finally {
  if (checkout.owned) rmSync(checkout.path, { recursive: true, force: true });
}
