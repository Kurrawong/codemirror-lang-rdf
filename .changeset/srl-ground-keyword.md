---
"@kurrawongai/codemirror-lang-sparql12": minor
"@kurrawongai/codemirror-lang-srl": minor
---

Rename the SRL keywords `WHERE DATA` and `NOT DATA` to `WHERE GROUND` and `NOT GROUND`, as w3c/data-shapes commit 004346d (2026-11-19) does. `WHERE DATA` and `NOT DATA` are now syntax errors. `DATA { … }` blocks do not change. `GROUND` is highlighted as a keyword and offered in completion. `srlToSparql` and `sparqlToSrl` read and write `GROUND`.

The SRL syntax corpus is now gh-pages at eacdef4: 212 entries, up from 173. Three of the new negative entries parse without error, and `srlConformanceDiagnostics` reports each of them: a `GROUP` inside a `NOT`, and an aggregate function in a `FILTER` and in a `SET`.
