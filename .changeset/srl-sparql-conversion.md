---
'@kurrawongai/codemirror-lang-srl': minor
---

Add SPARQL conversion and SRL conformance diagnostics.

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
