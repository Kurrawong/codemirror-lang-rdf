# Conformance

These parsers support editing incomplete documents. A parse without error nodes
does not establish that the input is valid. They do not check all value
constraints, scoping rules, or restrictions in the language specifications.

## Syntax coverage

Turtle and TriG include RDF 1.2 triple terms (`<<( s p o )>>`), reified triples
(`<< s p o ~reifier >>`), annotation blocks (`{| ... |}`), reifiers (`~`),
directional language tags (`@en--ltr`), and `VERSION`. N-Triples and N-Quads
use their own restricted productions: full IRIs, `"..."` strings only, and the
case-sensitive `VERSION "..."` line that RDF 1.2 allows before the first
triple. RDF Patch rows and headers use the N-Triples literal rules. Prefixed
names, blank node labels and variables accept the full `PN_CHARS_BASE` range,
including `#x10000-#xEFFFF`.

SPARQL supports query and update syntax, including property paths, federation,
aggregates, and update sequences. The 1.2 additions include the term forms
above, `VERSION`, and the built-ins `TRIPLE`, `isTRIPLE`, `SUBJECT`, `PREDICATE`,
`OBJECT`, `LANGDIR`, `hasLANG`, `hasLANGDIR`, and `STRLANGDIR`. The grammar
distinguishes triple terms in patterns, `VALUES` data, and expressions and
checks built-in argument counts where encoded in their productions.

SRL uses this rule form:

```text
RULE iri? HeadTemplate WHERE GROUND? BodyPattern
```

`GROUND` follows w3c/data-shapes commit 004346d (2026-11-19). The grammar
also accepts `DATA` in its place after `WHERE` and after `NOT`, the keyword's
name before that commit.

Rule bodies contain triples, filters, negation (`NOT GROUND? { ... }`),
assignment (`SET ( ?v := expression )`), grouping with aggregates
(`GROUP BY ?k { ... } [ ?n := COUNT(*) ]`), and tuple patterns (`TUPLE( ... )`).
The `GROUP` syntax follows
[w3c/data-shapes pull request #1347](https://github.com/w3c/data-shapes/pull/1347)
and the comma-separated assignment list of
[pull request #1375](https://github.com/w3c/data-shapes/pull/1375), which had
not been merged when it was implemented here: `[ ?n := COUNT(*), ?m := MAX(?o) ]`.
Its aggregates are `COUNT`, `MIN`, `MAX` and `SUM` over a single variable, plus
`COUNT(*)`; only `COUNT` accepts `DISTINCT`.
Rule sets can also contain ground `DATA` blocks and prologue declarations
between blocks. The older `IF ... THEN` and `FOR ... IN` forms are rejected.

## Corpus revisions

The tested revisions are recorded in the committed corpus `SOURCE` files.
These identify test snapshots; they are not dated snapshots of every
specification document.

| Corpus | Upstream commit | Local record |
| --- | --- | --- |
| RDF 1.1 and 1.2, SPARQL 1.0, 1.1 and 1.2 | `56076c0efec4c353efcae2971be8f6005294ac64` in `w3c/rdf-tests` | [corpus.config.json](../corpus.config.json) |
| SPARQL-RL syntax | `eacdef4528d66ee116f0ac9118d968c5717c7233` in `w3c/data-shapes`, branch `gh-pages` | [SRL SOURCE](../packages/lang-srl/test/corpus/srl-syntax/SOURCE) |

The `w3c/rdf-tests` corpus is every Turtle, TriG, N-Triples, N-Quads, query and
update file referenced from that repository's root manifests. Besides syntax
tests, it includes the inputs and expected results of evaluation tests, which
must parse. RDF/XML, CSV, TSV and JSON files are not parsed.

Language specifications: [Turtle](https://www.w3.org/TR/rdf12-turtle/),
[TriG](https://www.w3.org/TR/rdf12-trig/),
[N-Triples](https://www.w3.org/TR/rdf12-n-triples/),
[N-Quads](https://www.w3.org/TR/rdf12-n-quads/),
[SPARQL query](https://www.w3.org/TR/sparql12-query/), and
[SPARQL update](https://www.w3.org/TR/sparql12-update/), and
[SPARQL-RL](https://www.w3.org/TR/sparql12-rl/).
These links follow the published specifications and can change independently
of the corpus pins.

## Results

A positive entry must parse without error nodes. A negative entry must produce
at least one error node. The current corpus results are:

| Suite | Total files | Matching the expected result | Invalid inputs accepted |
| --- | --- | --- | --- |
| Turtle, TriG, N-Triples, N-Quads | 2,192 | 2,136 | 56 |
| SPARQL 1.0, 1.1 and 1.2 | 1,239 | 1,174 | 65 |
| SRL | 173 | 168 | 5 |

All positive files parse without errors. The remaining 126 files are negative
tests accepted by the grammars. These counts describe the vendored files, not
full language conformance or query evaluation.

Each package's `expected-fail.json` records the exceptions, keyed by upstream
path. Tests fail for an unlisted mismatch, a listed file that now matches, a
listed file absent from the corpus, or a listed positive file. A snapshot of
the per-directory counts makes a change in the vendored files visible in review.

## Known limitations

### Turtle family

The [56 exceptions](../packages/lang-turtle12/test/corpus/expected-fail.json)
cover:

- Escapes that are well formed but name a surrogate or other invalid code
  point, or that decode to a character IRIs forbid.
- `rdf:langString` or `rdf:dirLangString` as a datatype without a language tag
  or direction.
- Relative IRIs in N-Triples and N-Quads.
- Prefixes used without a declaration.

### SPARQL

The [65 exceptions](../packages/lang-sparql12/test/corpus/expected-fail.json)
cover:

- Query constraints: grouping and binding scope, duplicate aliases and
  variables, `VALUES` row widths, nested aggregates, and blank-node labels
  reused across basic graph patterns or update operations.
- Invalid Unicode code points and surrogate escapes.
- Variables or blank nodes in restricted update templates and `DATA` blocks,
  including the blank node an annotation without a named reifier creates.
- Annotations after property paths, including optional, alternative, and
  one-or-more paths. The grammar accepts these forms even where the syntax
  suite requires rejection.
- `?x<?a&&?b>?y`, where the specification's longest-match lexer reads
  `<?a&&?b>` as an IRI. Lezer lexes by context, so `<` is an operator there.

### SRL

The [eight exceptions](../packages/lang-srl/test/corpus/expected-fail.json)
are an undeclared prefix, four uses of variables in ground `DATA` blocks, a
`GROUP` inside a `NOT`, and an aggregate function in a `FILTER` and in a `SET`.
`variablesInDataBlocks(state)` returns the variable ranges for an application
to diagnose. `srlConformanceDiagnostics(state)` reports the last three. Prefix
resolution still requires a separate check.

SRL shares SPARQL's expression productions, so it accepts `!!?v` as SPARQL 1.2
does. The SRL grammar still has `'!' PrimaryExpression`, which allows one `!`.

### Large blocks of triples in SPARQL and SRL

A single group, `INSERT DATA` block or SRL `DATA` block with more than about
1,000 triples separated by `.` produces error nodes even when it is valid, and
the editor underlines them as parse errors. A block of 1,000 triples parses
without errors; 1,500 do not.

The `TriplesBlock` and `TriplesTemplate` productions in
[sparql.grammar](../packages/lang-sparql12/src/sparql.grammar) are
right-recursive, as in the SPARQL specification grammar, so the parser stack
grows with each triple. When the stack reaches 8,400 entries, Lezer
force-reduces it, and the forced reductions leave error nodes. Turtle and TriG
statements are not nested this way and are not affected.

## Run the checks

After installing dependencies, run `pnpm test` from the repository root.
This builds the packages and runs unit and conformance tests. See
[development](development.md) for browser tests and corpus updates.
