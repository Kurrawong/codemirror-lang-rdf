#!/usr/bin/env node
/**
 * Vendor the W3C syntax-test corpora into the packages that test against them.
 *
 * The corpora are committed, not fetched at test time: CI must not depend on
 * github.com being up, and a corpus that can change under a green build is not
 * a conformance guarantee. The pin lives in `corpus.config.json` and is written
 * into a `SOURCE` file beside each vendored group, so `git log` on the corpus
 * shows exactly which upstream revision a result was scored against.
 *
 * Usage:
 *   node scripts/vendor-corpus.mjs                 # clone the pinned revision
 *   node scripts/vendor-corpus.mjs --from <path>   # use an existing checkout
 *   node scripts/vendor-corpus.mjs --update        # re-pin to the clone's HEAD
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'corpus.config.json'), 'utf8'));

const args = process.argv.slice(2);
const fromIndex = args.indexOf('--from');
const update = args.includes('--update');
const providedCheckout = fromIndex >= 0 ? resolve(args[fromIndex + 1]) : null;

/**
 * A syntax-test manifest entry.
 *
 * Only `rdf:type` and `mf:action` are read. The manifests also carry names,
 * approval status and comments; none of that changes whether a document must
 * parse, and reading less means a manifest reformat cannot break the harness.
 */
function parseManifest(text, typeMap) {
  const entries = [];
  // Entries are `<subject> rdf:type <type> ; … .` blocks. Splitting on a
  // statement-final dot is not safe in general Turtle, so instead each
  // `rdf:type` line anchors a block that ends at the next one (or at EOF).
  const anchors = [...text.matchAll(/^(\S+)\s+rdf:type\s+(\S+)\s*[;,]/gm)];
  for (let i = 0; i < anchors.length; i++) {
    const [, name, type] = anchors[i];
    const start = anchors[i].index;
    const end = i + 1 < anchors.length ? anchors[i + 1].index : text.length;
    const expect = typeMap[type];
    if (!expect) continue;
    const action = /mf:action\s+<([^>]+)>/.exec(text.slice(start, end));
    if (!action) continue;
    entries.push({ name: name.replace(/^[^:]*:/, ''), file: action[1], expect });
  }
  return entries;
}

function gitCheckout() {
  if (providedCheckout) return { path: providedCheckout, owned: false };
  const dir = mkdtempSync(join(tmpdir(), 'rdf-tests-'));
  console.log(`cloning ${config.source.url} …`);
  execFileSync('git', ['clone', '--quiet', config.source.url, dir], { stdio: 'inherit' });
  if (!update) execFileSync('git', ['-C', dir, 'checkout', '--quiet', config.source.commit]);
  return { path: dir, owned: true };
}

const checkout = gitCheckout();
try {
  const head = execFileSync('git', ['-C', checkout.path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (update) {
    config.source.commit = head;
    writeFileSync(join(root, 'corpus.config.json'), `${JSON.stringify(config, null, 2)}\n`);
    console.log(`re-pinned to ${head}`);
  } else if (head !== config.source.commit && !providedCheckout) {
    throw new Error(`checkout is at ${head}, expected ${config.source.commit}`);
  }

  for (const group of config.groups) {
    const src = join(checkout.path, group.from);
    if (!existsSync(src)) throw new Error(`missing upstream directory: ${group.from}`);
    const dest = join(root, group.to);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });

    const manifest = readFileSync(join(src, 'manifest.ttl'), 'utf8');
    const entries = parseManifest(manifest, config.testTypes);
    if (entries.length === 0) throw new Error(`no syntax entries found in ${group.from}/manifest.ttl`);

    for (const entry of entries) cpSync(join(src, entry.file), join(dest, entry.file));
    entries.sort((a, b) => a.name.localeCompare(b.name));
    writeFileSync(join(dest, 'index.json'), `${JSON.stringify(entries, null, 2)}\n`);
    writeFileSync(
      join(dest, 'SOURCE'),
      [
        `${config.source.url}`,
        `commit: ${head}`,
        `path:   ${group.from}`,
        `entries: ${entries.filter((e) => e.expect === 'positive').length} positive, ` +
          `${entries.filter((e) => e.expect === 'negative').length} negative`,
        '',
        'Vendored by scripts/vendor-corpus.mjs. Do not edit by hand.',
        'Licensed under the W3C Test Suite License and the W3C 3-clause BSD License.',
        '',
      ].join('\n')
    );
    console.log(`${group.to}: ${entries.length} entries`);
  }
} finally {
  if (checkout.owned) rmSync(checkout.path, { recursive: true, force: true });
}
