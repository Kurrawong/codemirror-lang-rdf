---
'@kurrawongai/codemirror-lang-srl': patch
---

Fix SRL/SPARQL conversion of `NOT DATA` and `WHERE DATA`, which were silently
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
