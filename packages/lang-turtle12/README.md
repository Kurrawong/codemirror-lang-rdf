# @kurrawongai/codemirror-lang-turtle12

RDF 1.2 Turtle, TriG, N-Triples, and N-Quads support for CodeMirror 6.

## Get started

```sh
npm install codemirror @kurrawongai/codemirror-lang-turtle12
```

In your application's browser entry module:

```js
import { basicSetup, EditorView } from 'codemirror';
import { turtle } from '@kurrawongai/codemirror-lang-turtle12';

new EditorView({
  parent: document.body,
  doc: '@prefix ex: <http://example.org/> .\nex:s ex:p ex:o .',
  extensions: [basicSetup, turtle()],
});
```

Use `trig()`, `ntriples()`, or `nquads()` from the same package for those
formats. Turtle and TriG include prefix completion; N-Triples and N-Quads do
not include a completion source.

The parser supports editing incomplete documents. Use a separate validator
to check document validity.

## Documentation

- [Usage and completion](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/usage.md)
- [API reference](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/api.md#turtle-trig-n-triples-and-n-quads)
- [Highlight tags](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/highlight-tags.md)
- [Conformance and corpus revision](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/conformance.md)

## Licence

MIT. The grammar builds on the approach used by
[aatauil/codemirror-lang-turtle](https://github.com/aatauil/codemirror-lang-turtle)
(MIT). Vendored W3C tests use the W3C Test Suite License and W3C 3-clause BSD License.
