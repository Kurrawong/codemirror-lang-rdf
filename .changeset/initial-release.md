---
'codemirror-lang-turtle12': minor
'codemirror-lang-sparql12': minor
'codemirror-lang-srl': minor
---

First release: Lezer grammars and CodeMirror 6 language support for RDF 1.2,
SPARQL 1.2 and SRL.

**`codemirror-lang-turtle12`** — Turtle, TriG, N-Triples and N-Quads, four
entry points over one token set. RDF 1.2 triple terms, reified triples,
reifiers, annotation blocks, directional language tags and `VERSION`. Folding,
indentation and prefix-aware completion.

**`codemirror-lang-sparql12`** — SPARQL 1.2 query and update, all of 1.1
included: property paths, federation, aggregates, update sequences. The 1.2
additions are `VERSION`, the four bracketed term forms with their per-position
subject restrictions, and the `TRIPLE`/`isTRIPLE`/`SUBJECT`/`PREDICATE`/
`OBJECT`/`LANGDIR`/`hasLANG`/`hasLANGDIR`/`STRLANGDIR` built-ins. Keywords are
case-insensitive and not reserved; built-in arity is in the grammar.

**`codemirror-lang-srl`** — SRL on the same grammar, entered at a second
`@top`, so the two languages cannot disagree about a term. Folding per rule and
per `DATA` block, and tree helpers for rule spans, tuple spans and variables
that appear inside a ground `DATA` block.

Pinned against the RDF 1.2 and SPARQL 1.2 editor's drafts and the SRL draft as
of the vendored W3C syntax suites; each package's README names the revision.
