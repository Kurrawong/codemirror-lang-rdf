# codemirror-lang-rdf

CodeMirror 6 language support and Lezer parsers for RDF 1.2, SPARQL 1.2,
and SRL (SPARQL Rule Language). Includes highlighting, folding, indentation,
and completion for Turtle, TriG, SPARQL, and SRL.

| Package | Languages |
| --- | --- |
| [codemirror-lang-turtle12](packages/lang-turtle12/README.md) | Turtle, TriG, N-Triples, N-Quads |
| [codemirror-lang-sparql12](packages/lang-sparql12/README.md) | SPARQL query and update |
| [codemirror-lang-srl](packages/lang-srl/README.md) | SRL |

These are editor parsers. They accept some invalid documents and do not provide
validation diagnostics. N-Triples and N-Quads have no completion source.

## Try it locally

Requires Node.js 22 and pnpm 9.15.0.

```sh
git clone https://github.com/kwong/codemirror-lang-rdf.git
cd codemirror-lang-rdf
pnpm install --frozen-lockfile
pnpm demo
```

Open the URL printed in the terminal. The demo has samples for all six languages
and a syntax-tree inspector.

## Use in an application

The packages are not yet published on npm. Follow
[local installation](docs/usage.md#install-from-a-checkout) to install them
and `codemirror` in your application.

In a browser entry module processed by your application's bundler:

```js
import { basicSetup, EditorView } from 'codemirror';
import { sparql } from 'codemirror-lang-sparql12';

new EditorView({
  parent: document.body,
  doc: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }',
  extensions: [basicSetup, sparql()],
});
```

This creates a SPARQL editor. The package supplies syntax tags; your CodeMirror
theme controls the colours.

## Documentation

- [Usage](docs/usage.md): local installation, language selection, and completion.
- [API reference](docs/api.md): exports, options, and tree helpers.
- [Highlight tags](docs/highlight-tags.md): shared tags and custom styles.
- [Conformance](docs/conformance.md): syntax coverage, corpus revisions, and limitations.
- [Development](docs/development.md): build, tests, demo, and grammar changes.
- [Report an issue](https://github.com/kwong/codemirror-lang-rdf/issues).

## Licence

[MIT](LICENSE). See [NOTICE](NOTICE) for attribution. The Turtle and SPARQL grammars build on the approach used by
[aatauil/codemirror-lang-turtle](https://github.com/aatauil/codemirror-lang-turtle)
and [aatauil/codemirror-lang-sparql](https://github.com/aatauil/codemirror-lang-sparql),
both MIT. Vendored W3C tests use the W3C Test Suite License and W3C 3-clause BSD License.
