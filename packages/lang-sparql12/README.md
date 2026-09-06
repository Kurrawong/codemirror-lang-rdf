# codemirror-lang-sparql12

SPARQL 1.2 (query and update) support for CodeMirror 6, built on a Lezer
grammar. The same grammar also carries SRL — see
[`codemirror-lang-srl`](../lang-srl).

```js
import { sparql } from 'codemirror-lang-sparql12';

new EditorView({ extensions: [basicSetup, sparql()] });
```

## What it does

- **SPARQL 1.2 additions.** `VERSION`; `TripleTerm` (`<<( s p o )>>`),
  `ReifiedTriple` (`<< s p o ~reifier >>`), `Reifier`, `Annotation`
  (`{| … |}`); `TripleTermData` in `VALUES` and `ExprTripleTerm` in
  expressions, each with its own subject restrictions; `TRIPLE`, `isTRIPLE`,
  `SUBJECT`, `PREDICATE`, `OBJECT`, `LANGDIR`, `hasLANG`, `hasLANGDIR`,
  `STRLANGDIR`; directional language tags (`@en--ltr`).
- **All of SPARQL 1.1**, query and update, including property paths,
  federation, aggregates and the full update sequence.
- **Case-insensitive, non-reserved keywords.** `SELECT`, `select` and `SeLeCt`
  are one keyword; `select:p` is a prefixed name and `?select` a variable.
- **Arity in the grammar**, so `STRLEN(?a, ?b)` is a parse error rather than
  something for a later pass.
- **Folding** on `{ … }` groups, quad patterns, construct templates,
  argument lists, `VALUES` blocks and annotation blocks; **indentation** on the
  same.
- **Completion** of every keyword and built-in with its canonical spelling,
  the document's own `PREFIX` declarations, the variables the document already
  uses, and any prefixes an application supplies through `prefixSource`.

## Exports

| Export | What it is |
| --- | --- |
| `sparql(options?)` | `LanguageSupport`, with completion |
| `sparqlLanguage` | `LRLanguage`, for callers who compose their own extensions |
| `parser` | the unconfigured `LRParser`; `configure({ top: 'SparqlUnit' \| 'SrlUnit' })` |
| `sparqlProps` | the highlight/fold/indent props, if you configure the parser yourself |
| `documentPrefixes`, `documentVariables`, `knownPrefixes` | what the editor can see in the document |
| `sparqlCompletionSource(options)` | the completion source on its own |
| `sparqlKeywords`, `sparqlFunctions`, `srlKeywords` | the canonical spellings used for completion |
| `KEYWORDS`, `KEYWORD_NODE_NAMES` | the grammar's keyword set, lower-cased and as node names |

`options` is `{ prefixSource?, dialect? }`. Document declarations win over
`prefixSource` on conflict.

## Highlighting

Tags follow [`docs/highlight-tags.md`](../../docs/highlight-tags.md), shared
with `codemirror-lang-turtle12` and `codemirror-lang-srl`.

Keyword node names are `Kw` + the keyword in upper case (`KwSELECT`,
`KwGROUP_CONCAT`), and the keyword list exists once — in the grammar's
`@external specialize` block. `keywords.ts` derives both the case-insensitive
lookup and the `styleTags` rule from it, so adding a keyword is one edit.

## Tree shape

Node names are the W3C production names, so a consumer can walk the tree by
spec vocabulary: `SelectQuery`, `GroupGraphPattern`, `TriplesSameSubjectPath`,
`PropertyListPathNotEmpty`, `TripleTerm`, `Reifier`, `QuadPattern`.

One thing to expect: SPARQL's expression grammar is seven productions tall
before it reaches a leaf (`Expression` → `ConditionalOrExpression` → … →
`UnaryExpression` → the term), and the tree reflects that faithfully. If you
are looking for a term inside an expression, search by node name rather than
by walking down a fixed number of levels.

## Spec revisions

Pinned against [SPARQL 1.2 Query Language](https://www.w3.org/TR/sparql12-query/)
and [SPARQL 1.2 Update](https://www.w3.org/TR/sparql12-update/), grammar as of
the vendored test suite below. Both are still Working Drafts; a spec change is
treated as a minor release with a changelog entry.

## Conformance

Tested against the SPARQL 1.1 and 1.2 syntax suites vendored from
[`w3c/rdf-tests`](https://github.com/w3c/rdf-tests) at commit
`369a90d1a60c021b746df2e411da0ff36258a758` — see `test/corpus/*/SOURCE`. The
1.1 suites are included deliberately: a 1.2 grammar that stopped parsing 1.1
would be a regression the 1.2 suite alone cannot see.

A positive test must parse with no error node; a negative test must produce at
least one. **298 of the 334 entries are decided by the grammar, including all
95 positive triple-term tests.** The other 36 are listed with reasons in
`test/corpus/expected-fail.json`, and fall into four groups:

- **Scoping and arity** (15): `GROUP BY` scope, `BIND` scope, projection
  aliases, `VALUES` row width, nested aggregates, a blank-node label reused
  across two operations. These are conditions on a whole query, not shapes.
- **Code points** (6): lone or misordered surrogate escapes and an escape
  naming an invalid code point, which need arithmetic across two escape
  sequences.
- **Constraints stated in prose** (5): variables and blank nodes in
  `INSERT DATA` and `DELETE` templates, which the 1.1 grammar reaches through
  `TriplesTemplate` and forbids only in the surrounding text.
- **Annotation after a property path** (10). The interesting group: the
  restriction distinguishes a
  bare-predicate verb from a property path, and a single IRI is *both*, so an
  LR grammar cannot decide which production applies without an ambiguity
  split. Over-accepting here costs a reader nothing — the query still colours
  and folds correctly — whereas a GLR split to catch it would risk mis-parsing
  ordinary paths.

That list is asserted exactly, so an entry that starts passing must come off
it, and one that stops passing is a failing build.

Lezer does not replace a validating parser. It is an error-tolerant grammar for
painting and navigation; whether a query is *valid* is a question for a parser
that also resolves scopes and code points.

## Licence

MIT. The grammar is a rewrite for SPARQL 1.2 of the approach taken by
[`aatauil/codemirror-lang-sparql`](https://github.com/aatauil/codemirror-lang-sparql)
(MIT). The vendored test corpus is © W3C, under the W3C Test Suite License and
the W3C 3-clause BSD License.
