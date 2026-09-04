# codemirror-lang-turtle12

RDF 1.2 **Turtle**, **TriG**, **N-Triples** and **N-Quads** support for
CodeMirror 6, built on a Lezer grammar.

```js
import { turtle, trig, ntriples, nquads } from 'codemirror-lang-turtle12';

new EditorView({ extensions: [basicSetup, turtle()] });
```

## What it does

- **RDF 1.2 terms.** Triple terms (`<<( s p o )>>`), reified triples
  (`<< s p o ~reifier >>`), annotation blocks (`{| … |}`), reifiers (`~`),
  directional language tags (`@en--ltr`) and the `VERSION` directive.
- **Four entry points, one token set.** N-Triples and N-Quads are strict
  line-oriented subsets with their own `@top`, so an editor for them rejects a
  prefixed name or a `;` list rather than tolerating it.
- **Folding** on `[ … ]`, `( … )`, `{ … }` (TriG graph blocks), `{| … |}`, and
  on a whole statement from the end of its first line.
- **Indentation** inside the same delimiters.
- **Completion** of directives, `a`/`true`/`false`, and prefixed names read
  from the document's own `@prefix`/`PREFIX` declarations — plus any prefixes
  an application feeds in through `prefixSource`.
- **Bracket matching** via `@detectDelim`, and `#` line comments declared as
  language data so `toggleComment` works.

## Exports

| Export | What it is |
| --- | --- |
| `turtle(options?)`, `trig(options?)` | `LanguageSupport`, with completion |
| `ntriples()`, `nquads()` | `LanguageSupport` |
| `turtleLanguage`, `trigLanguage`, `ntriplesLanguage`, `nquadsLanguage` | `LRLanguage`, for callers who compose their own extensions |
| `parser` | the unconfigured `LRParser`; `parser.configure({ top })` picks a dialect |
| `documentPrefixes(state)`, `knownPrefixes(state, options)` | the prefixes the editor can see |
| `turtleCompletionSource(options, dialect)` | the completion source on its own |
| `turtleHighlighting` | the `styleTags` prop, if you configure the parser yourself |

`options` is `{ prefixSource?: PrefixMap | (state) => PrefixMap }`. Document
declarations win over `prefixSource` on conflict, because what the document
says is what the document means.

## Highlighting

Tags follow [`docs/highlight-tags.md`](../../docs/highlight-tags.md), which is
shared with `codemirror-lang-sparql12` and `codemirror-lang-srl` so one
`HighlightStyle` covers all six languages.

## Spec revisions

Pinned against these editor's drafts:

- [RDF 1.2 Turtle](https://www.w3.org/TR/rdf12-turtle/), W3C Candidate
  Recommendation, grammar as of the vendored test suite below.
- [RDF 1.2 TriG](https://www.w3.org/TR/rdf12-trig/).
- [RDF 1.2 N-Triples](https://www.w3.org/TR/rdf12-n-triples/) and
  [N-Quads](https://www.w3.org/TR/rdf12-n-quads/).

Node names are the W3C production names, so a consumer can walk the tree by
spec vocabulary (`TriplesSameSubject`-style naming: `Triples`,
`PredicateObjectList`, `TripleTerm`, `ReifiedTriple`, `WrappedGraph`).

## Conformance

Tested against the syntax suites vendored from
[`w3c/rdf-tests`](https://github.com/w3c/rdf-tests) at commit
`369a90d1a60c021b746df2e411da0ff36258a758` — see `test/corpus/*/SOURCE`.

A positive test must parse with no error node; a negative test must produce at
least one. 155 of the 165 entries are decided by the grammar. The other ten are
listed with reasons in `test/corpus/expected-fail.json`: every one is a
constraint on a *value* rather than a shape — lone surrogate escapes, a
datatype that requires a language tag, an IRI that must be absolute — which a
context-free token DFA cannot decide. That list is asserted exactly, so an
entry that starts passing must come off it.

Lezer does not replace a validating parser. It is an error-tolerant grammar for
painting and navigation; whether a document is *valid* is a question for a
parser that resolves IRIs and datatypes.

## Licence

MIT. The grammar is a rewrite for RDF 1.2 of the approach taken by
[`aatauil/codemirror-lang-turtle`](https://github.com/aatauil/codemirror-lang-turtle)
(MIT). The vendored test corpus is © W3C, under the W3C Test Suite License and
the W3C 3-clause BSD License.
