# @kurrawongai/codemirror-lang-srl

SRL (SPARQL Rule Language) support for CodeMirror 6, with highlighting,
folding, indentation, completion, and helpers for locating rules and data blocks.

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
