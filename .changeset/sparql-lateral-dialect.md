---
'@kurrawongai/codemirror-lang-sparql12': minor
'@kurrawongai/codemirror-lang-srl': patch
---

Add opt-in `LATERAL` (SEP-0006) to SPARQL: `sparql({ lateral: true })` parses
`A LATERAL { B }` as a `LateralGraphPattern`, highlights `LATERAL` as a keyword
and offers it in completion. The grammar gains a `lateral` dialect, also
exported as `sparqlLateralLanguage`. It is off by default, and `LATERAL` is
still a parse error without it. SRL is unchanged and never enables the dialect;
its package is bumped because it ships the regenerated shared parser.
