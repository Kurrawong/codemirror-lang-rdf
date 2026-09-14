---
'@kurrawongai/codemirror-lang-turtle12': minor
'@kurrawongai/codemirror-lang-sparql12': minor
'@kurrawongai/codemirror-lang-srl': minor
---

Add CodeMirror 6 language support and Lezer parsers for RDF 1.2, SPARQL 1.2,
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
