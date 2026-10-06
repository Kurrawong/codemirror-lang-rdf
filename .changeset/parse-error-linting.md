---
'@kurrawongai/codemirror-lang-turtle12': minor
'@kurrawongai/codemirror-lang-sparql12': minor
'@kurrawongai/codemirror-lang-srl': minor
---

Underline parse errors in the editor. `turtle()`, `trig()`, `ntriples()`,
`nquads()`, `sparql()` and `srl()` now include a linter that marks each parse
error, so an editor shows errors without a separate error list. Error nodes
separated only by whitespace or comments are reported as one error.

The Turtle and SPARQL packages export `parseErrors(state)`, which returns the
same errors for display elsewhere, and `parseErrorLinter()`. The SRL package
re-exports `parseErrors`. In `srl()`, a parse error that overlaps an SRL
conformance error is left out.

A SPARQL group or a SPARQL or SRL data block with more than about 1,000 triples
reports false parse errors because of a parser stack limit. See
docs/conformance.md.
