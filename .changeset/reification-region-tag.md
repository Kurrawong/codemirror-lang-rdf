---
'@kurrawongai/codemirror-lang-turtle12': minor
'@kurrawongai/codemirror-lang-sparql12': minor
'@kurrawongai/codemirror-lang-srl': minor
---

Tag the *contents* of the RDF 1.2 nested-triple constructs, not just their
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
