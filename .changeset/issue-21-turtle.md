---
'@kurrawongai/codemirror-lang-turtle12': patch
---

Accept characters from U+10000 to U+EFFFF in prefixed names and blank node labels, as `PN_CHARS_BASE` allows. Accept `VERSION "..."` before the first triple in N-Triples and N-Quads; the nodes are named `Version` and `KwVersion`, as in Turtle. Reject a prefixed name as the predicate of an N-Triples or N-Quads triple. Fixes [#21](https://github.com/Kurrawong/codemirror-lang-rdf/issues/21).
