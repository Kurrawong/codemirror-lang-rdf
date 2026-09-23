# @kurrawongai/codemirror-lang-srl

## 0.3.1

### Patch Changes

- 8af5dd5: Fix SRL/SPARQL conversion of `NOT DATA` and `WHERE DATA`, which were silently
  converted as plain `NOT` and `WHERE`.

  SRL's `DATA` forms match only the input data (the base graph), not inferred
  triples. SPARQL has no such distinction, so `srlToSparql` now converts them to
  a `GRAPH <{baseGraph}> { ... }` pattern and returns a warning. The placeholder
  is deliberately not a valid IRI, so the SPARQL shows a syntax error until it is
  replaced with the IRI of a named graph holding the input data. Pass
  `baseGraph` to use a real graph IRI instead. `sparqlToSrl` reads that `GRAPH`
  form back as `NOT DATA` or `WHERE DATA`.

  Conversion results gain an optional `warnings` array. Both directions now warn
  when a negation shares a variable that is bound only later in the body: SRL
  checks `NOT` where it is written, while SPARQL applies `FILTER NOT EXISTS` to
  the whole group, so the two can give different results.

  - @kurrawongai/codemirror-lang-sparql12@0.3.1

## 0.3.0

### Minor Changes

- d2f1f8a: Add SPARQL conversion and SRL conformance diagnostics.

  `srlToSparql` and `sparqlToSrl` convert between a single SRL `RULE` or `DATA`
  block and the corresponding SPARQL `CONSTRUCT`, `INSERT ... WHERE`, or
  `INSERT DATA` form. `SET` lowers to `BIND` plus `FILTER(BOUND(...))` and SRL
  `NOT` to `FILTER NOT EXISTS`, with the inverse recognising those spellings.
  Forms whose mapping is not well defined, including `UNION` and `TUPLE`, return
  a diagnostic instead of a lossy result, and every successful result is reparsed
  and checked in the target language.

  `srl()` now always reports SPARQL constructs that the shared grammar accepts
  but SRL does not, such as `BIND`, `EXISTS`, `FILTER NOT EXISTS`, SPARQL-only
  aggregates and built-ins, unsupported property paths, and variables in a ground
  `DATA` block. The new `sparqlConversions` option adds conversion actions to
  those diagnostics' tooltips for the forms that can be translated; it defaults to
  `false`, so the diagnostics appear without actions unless it is enabled.

  This adds `@codemirror/lint` as a dependency.

### Patch Changes

- Updated dependencies [d2f1f8a]
  - @kurrawongai/codemirror-lang-sparql12@0.3.0

## 0.2.0

### Minor Changes

- 9522121: Add CodeMirror 6 language support and Lezer parsers for RDF 1.2, SPARQL 1.2,
  and SRL.

  - `@kurrawongai/codemirror-lang-turtle12`: Turtle, TriG, N-Triples, and N-Quads parsers,
    with folding and indentation. Turtle and TriG include prefix completion.
  - `@kurrawongai/codemirror-lang-sparql12`: SPARQL query and update parsing, including
    property paths, aggregates, federation, and RDF 1.2 terms. Includes folding,
    indentation, and keyword, prefix, and variable completion.
  - `@kurrawongai/codemirror-lang-srl`: SRL support using the SPARQL grammar, with rule and
    data-block folding, completion, and helpers for rule, tuple, and variable ranges.

  These editor parsers accept some invalid documents. See the
  [conformance documentation](https://github.com/Kurrawong/codemirror-lang-rdf/blob/main/docs/conformance.md)
  for tested syntax, corpus revisions, and known limitations.

- 2eb4ecd: Assign distinct highlight tags to RDF 1.2 delimiters and reifiers:

  | Syntax          | Tag                     |
  | --------------- | ----------------------- |
  | `<< s p o >>`   | `special(angleBracket)` |
  | `<<( s p o )>>` | `special(paren)`        |
  | `{\| ... \|}`   | `special(brace)`        |
  | `~`             | `special(operator)`     |

  The delimiters previously used `brace`; `~` used `operator`.
  Styles targeting `bracket` or `operator` retain their fallback colours.
  Styles targeting only `brace` need rules for `angleBracket` and `paren`
  to cover reified-triple and triple-term delimiters.

- 7e85e5d: Tag the _contents_ of the RDF 1.2 nested-triple constructs, not just their
  brackets. Every token inside a reified triple, a triple term or an annotation
  block now also carries `quote`, **in addition** to its own tag — so an IRI in
  there is `quote url`, and a style can shade the whole construct while the terms
  inside keep their colours:

  ```js
  { tag: t.quote, backgroundColor: 'var(--reification-tint)' }
  ```

  Colouring the brackets says where a construct starts; tagging the contents says
  how far it reaches, which is the harder thing to see when `<< … >>` nests.

  One tag covers all three constructs, since the brackets already say which kind
  it is. `@kurrawongai/codemirror-lang-turtle12` now also exports `turtleProps` (parity with
  `sparqlProps`) so a consumer wanting per-kind region tags can re-configure the
  parser with props of their own.

  A style that never mentions `quote` produces byte-identical output to one
  written before this change. That is asserted, not assumed.

### Patch Changes

- Updated dependencies [9522121]
- Updated dependencies [2eb4ecd]
- Updated dependencies [7e85e5d]
  - @kurrawongai/codemirror-lang-sparql12@0.2.0
