---
'codemirror-lang-turtle12': minor
'codemirror-lang-sparql12': minor
'codemirror-lang-srl': minor
---

Assign distinct highlight tags to RDF 1.2 delimiters and reifiers:

| Syntax | Tag |
| --- | --- |
| `<< s p o >>` | `special(angleBracket)` |
| `<<( s p o )>>` | `special(paren)` |
| `{\| ... \|}` | `special(brace)` |
| `~` | `special(operator)` |

The delimiters previously used `brace`; `~` used `operator`.
Styles targeting `bracket` or `operator` retain their fallback colours.
Styles targeting only `brace` need rules for `angleBracket` and `paren`
to cover reified-triple and triple-term delimiters.
