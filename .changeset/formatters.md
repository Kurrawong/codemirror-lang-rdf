---
'@kurrawongai/codemirror-lang-turtle12': minor
'@kurrawongai/codemirror-lang-sparql12': minor
'@kurrawongai/codemirror-lang-srl': minor
---

Add formatters that change only the whitespace between tokens:
`formatTurtle(text, { dialect, indent })` for Turtle and TriG,
`formatSparql(text, { lateral, indent })` and `formatSrl(text, { indent })`.
Each returns the new text and the edits that produce it, and returns the input
unchanged with the first error when the document has a parse error. Comments,
prefix order and the text of every token are kept. Each package also exports a
CodeMirror command (`formatTurtleDocument`, `formatSparqlDocument`,
`formatSrlDocument`) that formats the editor's document in one transaction.
