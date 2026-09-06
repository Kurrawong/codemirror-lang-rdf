# codemirror-lang-rdf

Lezer grammars and CodeMirror 6 language support for **RDF 1.2**, **SPARQL
1.2** and **SRL**.

| Package | Languages |
| --- | --- |
| [`codemirror-lang-turtle12`](packages/lang-turtle12) | Turtle, TriG, N-Triples, N-Quads (RDF 1.2) |
| [`codemirror-lang-sparql12`](packages/lang-sparql12) | SPARQL 1.2 query and update |
| [`codemirror-lang-srl`](packages/lang-srl) | SRL, the SPARQL Rule Language |

```js
import { turtle, trig, ntriples, nquads } from 'codemirror-lang-turtle12';
import { sparql } from 'codemirror-lang-sparql12';
import { srl } from 'codemirror-lang-srl';

new EditorView({ extensions: [basicSetup, sparql()] });
```

## Why

No RDF 1.2 or SPARQL 1.2 Lezer grammar existed on npm. The 1.1 grammars that
do exist cannot see the 1.2 vocabulary at all: triple terms (`<<( s p o )>>`),
reified triples (`<< s p o ~reifier >>`), reifiers, annotation blocks
(`{| … |}`), directional language tags (`@en--ltr`), `VERSION`, and the whole
`TRIPLE`/`isTRIPLE`/`SUBJECT`/`PREDICATE`/`OBJECT`/`LANGDIR`/`hasLANG`/
`STRLANGDIR` family. An SRL document coloured by a SPARQL 1.1 grammar was worse
still: `RULE`, `SET` and `TUPLE` came out as plain text and `:=` read as an
empty prefix.

A Lezer grammar gives an editor what a round trip to a validating parser
cannot: keyword colour, folding, indentation, tree-based bracket matching and
structural completion, all of it error-tolerant so a document keeps working
while it is being written. It does **not** replace a validating parser —
whether a document is *valid* is a separate question, and one these grammars
deliberately leave alone (see [Conformance](#conformance)).

## Three packages, one repository

SPARQL 1.2 and SRL share every production below the rule body, so they are one
Lezer grammar with two `@top` rules, `SparqlUnit` and `SrlUnit`.
`codemirror-lang-srl` is a thin package: it configures the SPARQL parser to the
second entry point and adds SRL-specific folding, completion and tree helpers.
The two can therefore never disagree about what a term is — asserted by a test
that parses the same fragments through both entry points and compares node
names.

The three packages also share one conformance harness, one CI, one release
flow, and — importantly — one highlight-tag table, so an application can keep a
single `HighlightStyle` for all six languages.

## Highlighting

[`docs/highlight-tags.md`](docs/highlight-tags.md) is the tag table, and it is
a specification rather than a description: `test/highlight-conventions.test.ts`
asserts every row of it against every grammar that has the construct, in both
directions (a tag the table lists must be asserted; a tag a test asserts must
be listed). A tag cannot drift in one grammar without failing the build.

## Tree shape

Node names are the W3C production names — `Triples`, `PredicateObjectList`,
`GroupGraphPattern`, `TriplesSameSubjectPath`, `TripleTerm`, `ReifiedTriple`,
`QuadPattern`, `Rule`, `HeadTemplate` — so a consumer can walk the tree by spec
vocabulary. There is exactly one deviation, and it is documented where it
matters: SRL's ground data block is `SrlDataBlock`, because SPARQL 1.2 already
uses `DataBlock` for the payload of a `VALUES` clause.

## Conformance

Three test layers, the same in every package:

1. **Conformance corpus.** The W3C syntax suites, vendored at a pinned commit
   (`scripts/vendor-corpus.mjs`, `corpus.config.json`). A positive test must
   parse with no error node; a negative test must produce at least one.
2. **Tree shapes.** Written-out expectations rather than snapshots, so a node
   rename is a decision someone makes rather than a snapshot someone accepts.
3. **Editor behaviour.** `fold`, `indent` and `complete` through a headless
   `EditorState`, plus an end-to-end layer that drives real editors in Chromium
   and asserts what a reader actually sees.

Where each grammar stands:

| Suite | Decided | Source |
| --- | --- | --- |
| RDF 1.2 Turtle, TriG, N-Triples, N-Quads | 155 / 165 | [`w3c/rdf-tests`](https://github.com/w3c/rdf-tests) |
| SPARQL 1.1 and 1.2 syntax | 298 / 334 | [`w3c/rdf-tests`](https://github.com/w3c/rdf-tests) |
| SPARQL-RL syntax | 134 / 139 | [`w3c/data-shapes`](https://github.com/w3c/data-shapes) |

**Every positive test in all three suites passes.** The 51 undecided entries
are all *negative* tests, each listed with its reason in a committed
`test/corpus/expected-fail.json`, and they fall into a small number of kinds:

- **Conditions on a value, not a shape.** Lone or misordered surrogate escapes,
  an escape naming an invalid code point, a datatype that requires a language
  tag, an IRI that must be absolute. A token DFA cannot do arithmetic.
- **Conditions on a whole query.** `GROUP BY` and `BIND` scoping, duplicate
  projection aliases, `VALUES` row widths, nested aggregates, a blank-node
  label reused across two update operations.
- **Constraints the spec states in prose**, not in its grammar — variables and
  blank nodes in `INSERT DATA` and `DELETE` templates.
- **One genuine grammar restriction we chose not to encode**: an annotation
  after a property path. The rule distinguishes a bare-predicate verb from a
  property path, and a single IRI is *both*, so an LR grammar cannot decide
  which production applies without an ambiguity split. Over-accepting costs a
  reader nothing; a GLR split to catch it would risk mis-parsing ordinary
  paths.

Those lists are asserted **exactly**: an entry that starts passing must be
removed from the list, and an entry that stops passing is a failing build. A
grammar change that quietly drops a conformance test cannot pass CI, and the
list cannot become a place where working tests go to be ignored. The suite
sizes are asserted outright too, so a vendoring mistake that halved a corpus
reads as a failure rather than as a smaller green build.

## The demo

```
pnpm demo
```

Builds the packages and serves an editor on a local port (the URL is printed)
with a sample document per language, a fold gutter, completion, and one
`HighlightStyle` shared by all six — the arrangement `docs/highlight-tags.md`
says an application can keep.

Beside the editor is an inspector, and that is the half that earns its keep
while you are changing a grammar: the parse-error count, the highlight tag and
node path under the cursor, and the live syntax tree, where clicking a node
selects what it covers. Typing into it is how you find that a token went to the
wrong term long before a conformance file tells you. The `+` property-path bug
was found on the demo's first run, because no test in any vendored corpus uses
a `+` path modifier and nothing else had ever typed one.

`pnpm demo:build` writes a static bundle to `demo/dist` instead. It is a
`file://`-safe page, so it needs no server to look at.

## Working on this

```
pnpm install
pnpm run build          # compile the grammars and bundle the packages
pnpm test               # build, then the unit and conformance layers
pnpm run test:e2e       # real editors in Chromium
pnpm run typecheck
pnpm run test:all       # all three, in the order that fails fastest
pnpm demo               # the demo editor, with a syntax-tree inspector
pnpm run vendor-corpus  # re-vendor the corpora at the pinned commit
```

`pnpm run vendor-corpus --update` re-pins to the clone's `HEAD`; CI checks that
a plain run against the pin is a no-op, so the committed corpus can never drift
from what the tests are scoring against.

Tests import the packages from their built `dist`, not from `src`, so they
exercise the same entry points and `exports` map that an application would.

### The build does not typecheck

Each package builds in two steps: rollup compiles the grammar and strips types
with esbuild, then `tsc --emitDeclarationOnly` writes the `.d.ts` files. Nothing
in that path checks a type — `pnpm run typecheck` does, as its own step, which
CI runs before the build.

That split exists because TypeScript 7 is the native port and ships no
JavaScript compiler API, so `@rollup/plugin-typescript` (which reaches for
`ts.ScriptTarget`) cannot load at all. Splitting the jobs is the better shape
regardless: an explicit gate rather than a side effect of bundling, and a build
that takes about a second per package instead of three.

The one thing it depends on is `verbatimModuleSyntax`, which is set in
`tsconfig.base.json`. Type-stripping sees one file at a time and cannot know
whether an import is a type, so every type-only import has to say so. Leave that
setting on.

### Notes for anyone editing a grammar

Two things cost real time to work out, so they are worth knowing up front.

**A token `@precedence` is a global resolution, not a contextual one.** Lezer
tokenises per parse state, so two tokens that look alike but are never valid in
the same position need no precedence at all. Declaring one anyway *overrides*
the per-state choice: `@precedence { MulOp, "*" }` made `SELECT *` lex its star
as multiplication, and every `SELECT *` query failed to parse. Only declare a
precedence for a pair the generator actually complains about — and when you do,
order the **more specific pattern first**, which is how "the longer alternative
wins" is spelled out.

**Keywords are lexed once and specialised in JavaScript.** SPARQL's keywords
are case-insensitive and not reserved, so `SELECT`, `select` and `SeLeCt` are
one keyword while `select:p` is a prefixed name and `?select` a variable. The
grammar lexes one `Word` token and `keywords.ts` turns it into the right term,
which means the keyword list exists in exactly one place — the grammar's
`@external specialize` block — and both the case-insensitive lookup and the
`styleTags` rule are derived from it. Adding a keyword is one edit.

## Publishing

The three names were free on npm as of 2026-09-04 (§8 of the plan flagged this
as unverified; it is now verified). Nothing has been published yet: the first
release goes out through the changeset in `.changeset/`, which CI turns into a
release PR on `main` and publishes when that PR merges. Publishing needs an
`NPM_TOKEN` secret on the repository.

To develop an application against these before a release, `pnpm link` the three
packages from a local checkout, or let CI's release PR land a real `0.x`
version to pin.

## Spec revisions

Both SPARQL 1.2 and RDF 1.2 are Working Drafts, and the SRL draft is moving.
Each package's README names the revision it is pinned against, and a spec
change is treated as a minor release with a changelog entry saying so. `1.0.0`
waits for Recommendation.

## Licence

MIT. The Turtle and SPARQL grammars are rewrites for the 1.2 specs of the
approach taken by [`aatauil/codemirror-lang-turtle`](https://github.com/aatauil/codemirror-lang-turtle)
and [`aatauil/codemirror-lang-sparql`](https://github.com/aatauil/codemirror-lang-sparql),
both MIT. The vendored test corpora are © W3C, under the W3C Test Suite License
and the W3C 3-clause BSD License.
