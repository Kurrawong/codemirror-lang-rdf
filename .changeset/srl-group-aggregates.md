---
"@kurrawongai/codemirror-lang-sparql12": minor
"@kurrawongai/codemirror-lang-srl": minor
---

Parse SRL `GROUP` aggregates, following w3c/data-shapes pull request #1347:
`GROUP BY ?k { ... } [ ?n := COUNT(*) ]` in a rule body. The group pattern
holds triples, `FILTER` and `SET`. The aggregates are `COUNT`, `MIN`, `MAX` and
`SUM` over one variable, plus `COUNT(*)`, and only `COUNT` accepts `DISTINCT`.
An empty aggregate list is written `[]`.

The syntax tree adds `GroupAggregate`, `GroupPattern`, `ListVars`,
`AggregationAssignment` and `AggregationFunction`. Group patterns fold and
indent like other SRL blocks, and SRL completion offers `GROUP`.

The SRL conformance check no longer reports `COUNT`, `MIN`, `MAX`, `SUM` or
`DISTINCT` inside a `GROUP` aggregate, and reports a `GROUP` inside a `NOT`
body. `srlToSparql` lowers a `GROUP` to a SPARQL subquery.

The vendored SRL syntax suite now comes from the head of that pull request:
172 tests, up from 139.
