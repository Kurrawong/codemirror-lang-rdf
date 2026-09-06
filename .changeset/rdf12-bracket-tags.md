---
'codemirror-lang-turtle12': minor
'codemirror-lang-sparql12': minor
'codemirror-lang-srl': minor
---

Tag the three RDF 1.2 term brackets apart from each other and from ordinary
grouping, so a style can colour a reified triple differently from a triple
term:

| | |
| --- | --- |
| `<< s p o >>` | `special(angleBracket)` |
| `<<( s p o )>>` | `special(paren)` |
| `{\| … \|}` | `special(brace)` |
| `~` | `special(operator)` |

Previously all of these were `brace` (and `~` was `operator`), so no style could
distinguish them however much it wanted to. Each new tag is a `special()` of the
standard tag its glyphs actually are, and `angleBracket`, `paren` and `brace` all
derive from `bracket`, so an existing style that colours brackets keeps colouring
all of them unchanged. Nothing is required of a consumer.
