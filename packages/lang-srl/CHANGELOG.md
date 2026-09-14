# @kurrawongai/codemirror-lang-srl

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
