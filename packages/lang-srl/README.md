# @kurrawongai/codemirror-lang-srl

SRL (SPARQL Rule Language) support for CodeMirror 6, with highlighting,
folding, indentation, completion, and helpers for locating rules and data blocks.

The SPARQL 1.2 RL specification targeted by this package is a W3C Working
Draft, not a final Recommendation. Its syntax may change; see the project's
[standards status](https://github.com/kurrawong/codemirror-lang-rdf#standards-status).

It also includes explicit, conservative source transforms for the common
single-rule / single-`CONSTRUCT` case:

```js
import { srlToSparql, sparqlToSrl } from '@kurrawongai/codemirror-lang-srl';

const result = srlToSparql('RULE { ?s :out ?x } WHERE { SET ( ?x := 1 ) }', { form: 'insert' });
if (result.text) console.log(result.text);
else console.log(result.diagnostics);
```

`SET` lowers to `BIND` plus `FILTER(BOUND(...))`; SRL `NOT` lowers to `FILTER
NOT EXISTS`. `RULE` exports as either `CONSTRUCT` or `INSERT ... WHERE`;
ground `DATA` exports as `CONSTRUCT { ... } WHERE {}` or `INSERT DATA`.
The inverse recognises those simple forms. More complex forms, including
`UNION` and `TUPLE`, return a diagnostic rather than losing meaning. A named
SRL rule exports as an expanded-IRI comment before the SPARQL operation. That
comment is deliberately not imported, so SPARQL-to-SRL conversion is lossy for
the rule identifier. Conversion also refuses source that is not valid in its
input language; it never uses shared-parser recovery to reinterpret invalid SRL
as SPARQL. Before a successful result is returned, it is parsed and checked
again in the target language.

SRL conformance errors are always reported, including SPARQL `BIND`, `EXISTS`
and `FILTER NOT EXISTS`, SPARQL-only aggregates and built-ins, unsupported
property paths, and variables in a ground `DATA` block. SRL uses `SET` and
`NOT { ... }` for the two directly convertible cases. Enable optional
assistance to add conversion actions:

```js
import { srl } from '@kurrawongai/codemirror-lang-srl';

const extensions = [srl({ sparqlConversions: true })];
```

It reports `BIND(expr AS ?x)` in an SRL body as an error. When it is followed by
`FILTER(BOUND(?x))`, the tooltip calls the conversion exact; otherwise it
explains SRL `SET`'s guarded equivalent. Both forms include a `Convert SPARQL
BIND to SRL SET` action. With the option off, both remain errors but have no
conversion action.

## Get started

```sh
npm install codemirror @kurrawongai/codemirror-lang-srl
```

In your application's browser entry module:

```js
import { basicSetup, EditorView } from 'codemirror';
import { srl } from '@kurrawongai/codemirror-lang-srl';

new EditorView({
  parent: document.body,
  doc: 'RULE { ?s <http://example.org/q> ?o } WHERE { ?s <http://example.org/p> ?o }',
  extensions: [basicSetup, srl()],
});
```

The supported rule form is `RULE ... WHERE ...`. The older `IF ... THEN`
and `FOR ... IN` forms are rejected.

Use a separate validator to check rule-set validity. The `tuples: false`
option removes `TUPLE` from completion; it does not reject tuple syntax or
create diagnostics.

## Documentation

- [Usage and completion](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/usage.md)
- [API and tree helpers](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/api.md#srl)
- [Highlight tags](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/highlight-tags.md)
- [Conformance and corpus revision](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/conformance.md)

## Licence

MIT. Vendored W3C tests use the W3C Test Suite License and W3C 3-clause BSD License.
