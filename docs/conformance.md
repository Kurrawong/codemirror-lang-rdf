# Conformance

These parsers support editing incomplete documents. A parse without error nodes
does not establish that the input is valid. They do not check all value
constraints, scoping rules, or restrictions in the language specifications.

## Syntax coverage

Turtle and TriG include RDF 1.2 triple terms (`<<( s p o )>>`), reified triples
(`<< s p o ~reifier >>`), annotation blocks (`{| ... |}`), reifiers (`~`),
directional language tags (`@en--ltr`), and `VERSION`. N-Triples and N-Quads
use their own restricted productions.

SPARQL supports query and update syntax, including property paths, federation,
aggregates, and update sequences. The 1.2 additions include the term forms
above, `VERSION`, and the built-ins `TRIPLE`, `isTRIPLE`, `SUBJECT`, `PREDICATE`,
`OBJECT`, `LANGDIR`, `hasLANG`, `hasLANGDIR`, and `STRLANGDIR`. The grammar
distinguishes triple terms in patterns, `VALUES` data, and expressions and
checks built-in argument counts where encoded in their productions.

SRL uses this rule form:

```text
RULE iri? HeadTemplate WHERE DATA? BodyPattern
```

Rule bodies contain triples, filters, negation (`NOT DATA? { ... }`),
assignment (`SET ( ?v := expression )`), and tuple patterns (`TUPLE( ... )`).
Rule sets can also contain ground `DATA` blocks and prologue declarations
between blocks. The older `IF ... THEN` and `FOR ... IN` forms are rejected.

## Corpus revisions

The tested revisions are recorded in the committed corpus `SOURCE` files.
These identify test snapshots; they are not dated snapshots of every
specification document.

| Corpus | Upstream commit | Local record |
| --- | --- | --- |
| RDF 1.2 and SPARQL 1.1/1.2 syntax | `369a90d1a60c021b746df2e411da0ff36258a758` in `w3c/rdf-tests` | [corpus.config.json](../corpus.config.json) |
| SPARQL-RL syntax | `9c863967bceaef1a87c24e4dd761eda763823120` in `w3c/data-shapes`, branch `gh-pages` | [SRL SOURCE](../packages/lang-srl/test/corpus/srl-syntax/SOURCE) |

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

A positive syntax test must parse without error nodes. A negative syntax test
must produce at least one error node. The current corpus results are:

| Suite | Total cases | Matching the expected result | Invalid inputs accepted |
| --- | --- | --- | --- |
| Turtle, TriG, N-Triples, N-Quads | 165 | 155 | 10 |
| SPARQL 1.1 and 1.2 | 334 | 298 | 36 |
| SRL | 139 | 134 | 5 |

All positive cases parse without errors. The remaining 51 cases are negative
tests accepted by the grammars. These counts describe the vendored syntax
tests, not full language conformance or query evaluation.

Each package's `expected-fail.json` records the exceptions. Tests fail for an
unlisted mismatch, a listed case that now matches, or an exception absent from
its corpus group. Tests also check the expected size of each group.

## Known limitations

### Turtle family

The [10 exceptions](../packages/lang-turtle12/test/corpus/expected-fail.json)
cover invalid Unicode surrogate escapes, language/direction requirements for
typed literals, and a relative IRI in N-Triples. The grammar does not perform
the corresponding value checks.

### SPARQL

The [36 exceptions](../packages/lang-sparql12/test/corpus/expected-fail.json)
cover:

- Query constraints: grouping and binding scope, duplicate aliases and
  variables, `VALUES` row widths, nested aggregates, and blank-node labels
  reused across update operations.
- Invalid Unicode code points and surrogate escapes.
- Variables or blank nodes in restricted update templates.
- Annotations after property paths, including optional, alternative, and
  one-or-more paths. The grammar accepts these forms even where the syntax
  suite requires rejection.

### SRL

The [five exceptions](../packages/lang-srl/test/corpus/expected-fail.json)
are an undeclared prefix and four uses of variables in ground `DATA` blocks.
`variablesInDataBlocks(state)` returns the variable ranges for an application
to diagnose. Prefix resolution still requires a separate check.

## Run the checks

After installing dependencies, run `pnpm test` from the repository root.
This builds the packages and runs unit and conformance tests. See
[development](development.md) for browser tests and corpus updates.
