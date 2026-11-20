---
'@kurrawongai/codemirror-lang-turtle12': patch
---

Accept characters from U+10000 to U+EFFFF in prefixed names and blank node labels, as `PN_CHARS_BASE` allows. Accept `VERSION "..."` before the first triple in N-Triples and N-Quads; the nodes are named `Version` and `KwVersion`, as in Turtle. Reject a prefixed name as the predicate of an N-Triples or N-Quads triple. In N-Triples, N-Quads and RDF Patch rows and headers, reject single-quoted and long strings and a prefixed name as a datatype, as N-Triples syntax requires. Fixes [#21](https://github.com/Kurrawong/codemirror-lang-rdf/issues/21).
