---
'@kurrawongai/codemirror-lang-sparql12': patch
'@kurrawongai/codemirror-lang-srl': patch
---

Accept characters from U+10000 to U+EFFFF in prefixed names, blank node labels and variables, as `PN_CHARS_BASE` allows. Accept nested negation such as `!!?v`, following SPARQL 1.2 rule 135. SRL shares the expression grammar, so it accepts `!!` too. Fixes [#21](https://github.com/Kurrawong/codemirror-lang-rdf/issues/21).
