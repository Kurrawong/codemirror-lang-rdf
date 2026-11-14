# @kurrawongai/codemirror-lang-turtle12

RDF 1.2 Turtle, TriG, N-Triples, and N-Quads support for CodeMirror 6, and
[RDF Patch](https://afs.github.io/rdf-delta/rdf-patch.html) with N-Quads terms.

The RDF 1.2 specifications targeted by this package are W3C Working Drafts,
not final Recommendations. Their syntax may change; see the project's
[standards status](https://github.com/kurrawong/codemirror-lang-rdf#standards-status).

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

Use `trig()`, `ntriples()`, `nquads()`, or `rdfPatch()` from the same package
for those formats. Turtle and TriG include prefix completion; N-Triples,
N-Quads and RDF Patch do not include a completion source. In RDF Patch, tokens
in `A` and `PA` rows carry the `inserted` highlight tag, and tokens in `D` and
`PD` rows carry `deleted`.

The parser supports editing incomplete documents, and the editor underlines
parse errors. Use a separate validator to check document validity.

## Documentation

- [Usage and completion](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/usage.md)
- [API reference](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/api.md#turtle-trig-n-triples-n-quads-and-rdf-patch)
- [Highlight tags](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/highlight-tags.md)
- [Conformance and corpus revision](https://github.com/kurrawong/codemirror-lang-rdf/blob/main/docs/conformance.md)

## Licence

MIT. The grammar builds on the approach used by
[aatauil/codemirror-lang-turtle](https://github.com/aatauil/codemirror-lang-turtle)
(MIT). Vendored W3C tests use the W3C Test Suite License and W3C 3-clause BSD License.
