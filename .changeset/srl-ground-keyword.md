---
"@kurrawongai/codemirror-lang-sparql12": minor
"@kurrawongai/codemirror-lang-srl": minor
---

Accept `WHERE GROUND` and `NOT GROUND`, the names that w3c/data-shapes commit 004346d (2026-11-19) gives the SRL keywords `WHERE DATA` and `NOT DATA`. The grammar still accepts `DATA` in the same two places. `GROUND` is highlighted as a keyword and offered in completion. `srlToSparql` lowers both spellings the same way, and `sparqlToSrl` writes `GROUND`.

The SRL syntax corpus is now gh-pages at eacdef4: 212 entries, up from 173. Three of the new negative entries parse without error, and `srlConformanceDiagnostics` reports each of them: a `GROUP` inside a `NOT`, and an aggregate function in a `FILTER` and in a `SET`.
