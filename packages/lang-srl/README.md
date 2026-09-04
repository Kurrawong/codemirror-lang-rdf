# codemirror-lang-srl

SRL (the SPARQL Rule Language, formerly SPARQL-RL) support for CodeMirror 6.

```js
import { srl } from 'codemirror-lang-srl';

new EditorView({ extensions: [basicSetup, srl()] });
```

## No grammar of its own

This package has no `.grammar` file. SRL's productions live in
[`codemirror-lang-sparql12`](../lang-sparql12)'s `sparql.grammar` alongside
SPARQL's, and `srl()` is that parser entered at a second `@top`:

```js
sparqlParser.configure({ top: 'SrlUnit' })
```

That is deliberate, and it is the reason the two languages are one repository.
SRL is SPARQL below the rule body — the same triples, paths, expressions,
built-ins and 1.2 terms — so sharing the grammar means the two **cannot**
disagree about what a term is. A `<<( … )>>` in a rule body is the same node as
a `<<( … )>>` in a query, and there is nothing to keep in step. The test suite
asserts this directly: a set of fragments is parsed through both entry points
and the node names must match exactly.

## The language

One rule production:

```
RULE iri? HeadTemplate 'WHERE' 'DATA'? BodyPattern
```

plus ground `DATA { … }` blocks and a prologue that may appear anywhere between
them. Body items are triples, `FILTER`, `NOT DATA? { … }` (negation),
`SET ( ?v := expr )` (assignment) and — with the rule-tuples extension —
`TUPLE( … )`.

**There is no `IF … THEN` and no `FOR … IN`.** Both were removed from the SRL
grammar upstream on 2026-08-24 ([w3c/data-shapes](https://github.com/w3c/data-shapes)
commits `58fdfc6` and `cfbcd3c`), together with the five conformance tests that
covered them. This grammar follows the current spec, and asserts that both
forms are errors rather than leaving it to chance.

`SET`, `RULE`, `TUPLE`, `DATA` and `NOT` are ordinary case-insensitive keywords
in the shared grammar, so `:set`, `set:p` and `?set` all still read as names —
tested, because the whole keyword mechanism depends on it. A bare `NOT {` does
not collide with `NOT EXISTS` or `NOT IN`, and `:=` is one token rather than an
empty prefix followed by `=`.

## What it gives an editor

- **Folding** per rule head, per rule body, per `DATA` block and per negation.
- **Indentation** inside all of the same.
- **Completion** of the SRL keywords, every SPARQL keyword and built-in, the
  document's own prefixes and the variables it already uses.
- **Tree navigation** by spec vocabulary: `RuleSet`, `Rule`, `HeadTemplate`,
  `BodyPattern`, `Negation`, `Assignment`, `TuplePattern`, `TupleTemplate`.

## Exports

| Export | What it is |
| --- | --- |
| `srl(options?)` | `LanguageSupport`, with completion |
| `srlLanguage` | `LRLanguage`, for callers who compose their own extensions |
| `parser` | the SPARQL 1.2 `LRParser` configured to `top: 'SrlUnit'` |
| `ruleRanges(state)` | the span of each `Rule`, in order |
| `dataBlockRanges(state)` | the span of each ground `DATA` block |
| `tupleRanges(state)` | the span of each `TUPLE( … )`, labelled by position |
| `variablesInDataBlocks(state)` | variables that appear inside a ground `DATA` block |
| `documentPrefixes`, `documentVariables`, `knownPrefixes` | re-exported from the SPARQL package |

`options` is `{ prefixSource?, tuples? }`.

### `tuples`

`tuples: false` does **not** change what parses. `TUPLE( … )` is always in the
grammar, because a grammar with two shapes is a grammar that can disagree with
itself, and because an editor that silently stops colouring `TUPLE` tells the
author nothing about why. What the flag changes is the advice: the completion
list leaves `TUPLE` out, and `tupleRanges()` hands you the spans to raise
diagnostics on — matching the gate on `parseRuleSet(text, { tuples })`.

### The helpers, and why they exist

`ruleRanges` and `dataBlockRanges` exist so an application can find block
boundaries locally instead of asking a server for them: with `Rule` and
`SrlDataBlock` in the tree, only the stratum *numbers* need a round trip, so a
per-rule gutter stops lagging a keystroke behind the document.

`variablesInDataBlocks` covers a case the grammar deliberately accepts. A
`DATA` block is ground triples by definition, so `DATA { :s :p ?o }` is an
error — but encoding that would mean a third parallel triples hierarchy
(ground, alongside path and non-path) for one rule, and the parse error it
produced would point at the block rather than at the variable. So the grammar
accepts it and this returns the variable's own span, which is what a linter
wants: underline `?o` and say why.

## One deviation from the spec's names

Node names are the spec's production names, with one exception. SRL's spec
calls a ground data block `DataBlock`, and so does SPARQL 1.2 — where
`DataBlock` is the payload of a `VALUES` clause. Two productions cannot share a
node name in one grammar, and renaming SPARQL's would be worse (it is a
production a SPARQL consumer looks for), so SRL's is **`SrlDataBlock`**.
`dataBlockRanges()` is the ordinary way to find them.

## Conformance

Tested against the SPARQL-RL syntax suite from
[`w3c/data-shapes`](https://github.com/w3c/data-shapes) `gh-pages` at commit
`9c863967bceaef1a87c24e4dd761eda763823120` — see `test/corpus/srl-syntax/SOURCE`.

**134 of the 139 entries are decided by the grammar, including all 109 positive
tests.** The five exceptions are in `test/corpus/expected-fail.json`: one is an
undeclared prefix (a question about the prologue, not about shape), and four
are variables inside a ground `DATA` block, which `variablesInDataBlocks()`
reports with a better message than a parse error would carry. That list is
asserted exactly, so an entry that starts passing must come off it.

Lezer does not replace the Traqula parser. Traqula stays the source of truth
for whether a rule set is valid; this is an error-tolerant grammar for painting
and navigation.

## Licence

MIT. The vendored test corpus is © W3C, under the W3C Test Suite License and
the W3C 3-clause BSD License.
