# @kurrawongai/codemirror-lang-sparql12

SPARQL 1.2 query and update support for CodeMirror 6, with highlighting,
folding, indentation, and keyword, prefix, and variable completion.

## Get started

```sh
npm install codemirror @kurrawongai/codemirror-lang-sparql12
```

In your application's browser entry module:

```js
import { basicSetup, EditorView } from 'codemirror';
import { sparql } from '@kurrawongai/codemirror-lang-sparql12';

new EditorView({
  parent: document.body,
  doc: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }',
  extensions: [basicSetup, sparql()],
});
```

The parser supports editing incomplete queries. It accepts some invalid
syntax and does not check query semantics. Use a separate validator before
executing a query when validation is required.

## Documentation

- [Usage and completion](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/usage.md)
- [API reference](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/api.md#sparql)
- [Highlight tags](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/highlight-tags.md)
- [Conformance and corpus revision](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/conformance.md)

## Licence

MIT. The grammar builds on the approach used by
[aatauil/codemirror-lang-sparql](https://github.com/aatauil/codemirror-lang-sparql)
(MIT). Vendored W3C tests use the W3C Test Suite License and W3C 3-clause BSD License.
