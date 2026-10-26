---
"@kurrawongai/codemirror-lang-sparql12": minor
"@kurrawongai/codemirror-lang-srl": minor
---

Require a comma between the aggregation assignments of an SRL `GROUP`,
following w3c/data-shapes pull request #1375:
`[ ?n := COUNT(*), ?m := MAX(?o) ]`. Assignments separated only by whitespace,
which 0.5.0 accepted, are now a parse error, and so is a trailing comma.

The syntax tree adds an `AggregationAssignments` node around the list. The
vendored SRL syntax suite now comes from the head of that pull request: 173
tests, up from 172.
