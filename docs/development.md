# Development

## Build and test

Use Node.js 22 and pnpm 9.15.0, matching the CI Node version and the root
`packageManager` setting. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm exec playwright install chromium
pnpm run test:all
```

On Linux, `pnpm exec playwright install --with-deps chromium` can also install
the browser's system dependencies. `PW_CHROMIUM` can point to an existing
Chromium executable; see [playwright.config.ts](../playwright.config.ts).

| Command | Runs |
| --- | --- |
| `pnpm run build` | Grammar generation, JavaScript bundles, and TypeScript declarations |
| `pnpm test` | Build, then Vitest unit and conformance tests |
| `pnpm run typecheck` | Package and test typechecks; build first on a fresh checkout |
| `pnpm run test:e2e` | Chromium tests; build the packages first |
| `pnpm run test:all` | Build, typecheck, Vitest, then Chromium tests |
| `pnpm run test:watch` | Vitest in watch mode; rebuild packages after source changes |

Tests import built packages from `dist`. SRL also imports the SPARQL package
by name, so SPARQL declarations must exist before typechecking SRL.

Rollup generates the parsers and uses esbuild to strip TypeScript types.
`tsc --emitDeclarationOnly` emits declarations. Run the explicit typecheck
command as well; CI runs it after the build. Keep `verbatimModuleSyntax`
enabled and mark type-only imports with `import type`.

## Run the demo

```sh
pnpm demo
```

Open the printed local URL. The demo includes six language samples, folding,
completion, three palettes, a parse-error count, and a syntax-tree inspector.
The inspector shows the tag and node path at the cursor; selecting a tree
node selects its text.

After a grammar change, run `pnpm run build` in another terminal and reload
the page. The demo watches its bundle inputs but does not rebuild packages.

For a static copy:

```sh
pnpm demo:build
```

Open `demo/dist/index.html` in a browser. The bundle works over `file://`
and does not require a server. The palette implementation is in
[demo/src/theme.ts](../demo/src/theme.ts).

## Grammar structure

The [Turtle grammar](../packages/lang-turtle12/src/turtle.grammar) has four
entry points: `TurtleDoc`, `TrigDoc`, `NTriplesDoc`, and `NQuadsDoc`.

The [SPARQL grammar](../packages/lang-sparql12/src/sparql.grammar) has
`SparqlUnit` and `SrlUnit` entry points. SRL reuses its term, path, expression,
and built-in productions. The SRL package configures the second entry point
and supplies completion options and tree helpers. Tests compare node names
for shared fragments parsed through both entry points.

SRL's ground data block is named `SrlDataBlock` to distinguish it from the
SPARQL `DataBlock` used by `VALUES`. See [API reference](api.md#syntax-tree-names).

SPARQL keywords are matched case-insensitively by specialising a `Word` token.
The grammar's `@external specialize` block supplies the `Kw...` terms used by
[keywords.ts](../packages/lang-sparql12/src/keywords.ts) for lookup and
highlighting. Completion spellings are maintained separately in
[complete.ts](../packages/lang-sparql12/src/complete.ts). Update those lists
when adding a keyword that should be offered as a completion.

When changing token precedence, test each syntactic use of overlapping tokens.
In particular, `*` occurs in wildcard projections, multiplication, and paths;
`+` occurs in arithmetic and path modifiers. Include valid examples as well
as the invalid case motivating a change.

## Test coverage

- Conformance tests compare parser error nodes with the pinned syntax corpora.
- Tree tests assert expected production names and structure.
- Editor tests exercise completion, indentation, and folding in an `EditorState`.
- Chromium tests exercise rendered highlighting and editing workflows.
- [Highlight convention tests](../test/highlight-conventions.test.ts) check
  the shared [tag table](highlight-tags.md) and parent-tag fallbacks.

Add focused tests for changed behaviour. When changing a tag, update the table
and its convention tests together. When changing a production name, review
tree helpers and tests that consume it.

## Update the RDF and SPARQL corpora

```sh
pnpm run vendor-corpus
```

This fetches `w3c/rdf-tests` at the commit in
[corpus.config.json](../corpus.config.json) and replaces the configured corpus
directories. Git and network access are required. CI checks that this command
does not change the committed corpora.

`pnpm run vendor-corpus --update` updates the pin to the fetched repository's
HEAD. Review the config, `SOURCE` files, case indexes, suite-size assertions,
and expected-failure lists, then run the tests before committing the update.

`--from /path/to/rdf-tests` uses an existing checkout at its current HEAD.
Without `--update`, it does not change or enforce the configured pin for that
checkout; check its revision before using it to reproduce the corpus.

The script does not refresh SRL. Its tests came from a separate snapshot of
`w3c/data-shapes`; the revision and origin are recorded in its
[SOURCE file](../packages/lang-srl/test/corpus/srl-syntax/SOURCE).

See [changeset instructions](../.changeset/README.md) for recording package changes.
