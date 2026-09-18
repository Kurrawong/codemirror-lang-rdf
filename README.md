# codemirror-lang-rdf

CodeMirror 6 language support and Lezer parsers for RDF 1.2, SPARQL 1.2,
and SRL (SPARQL Rule Language). Includes highlighting, folding, indentation,
and completion for Turtle, TriG, SPARQL, and SRL.

## Standards status

This project follows evolving W3C 1.2 specifications. As of 18 September 2026,
none of the specifications below is a final W3C Recommendation; all are
Working Drafts and may change. A package version describes this project's
implementation, not the maturity or stability of the underlying standard.

| Specification | W3C status | Published |
| --- | --- | --- |
| [RDF 1.2 Turtle](https://www.w3.org/TR/rdf12-turtle/) | Working Draft | 14 September 2026 |
| [RDF 1.2 TriG](https://www.w3.org/TR/rdf12-trig/) | Working Draft | 15 September 2026 |
| [RDF 1.2 N-Triples](https://www.w3.org/TR/rdf12-n-triples/) | Working Draft | 23 July 2026 |
| [RDF 1.2 N-Quads](https://www.w3.org/TR/rdf12-n-quads/) | Working Draft | 23 July 2026 |
| [SPARQL 1.2 Query](https://www.w3.org/TR/sparql12-query/) | Working Draft | 13 September 2026 |
| [SPARQL 1.2 Update](https://www.w3.org/TR/sparql12-update/) | Working Draft | 12 June 2026 |
| [SPARQL 1.2 RL](https://www.w3.org/TR/sparql12-rl/) | Working Draft | 2 September 2026 |

## Demo

[Try the live editor](https://kurrawong.github.io/codemirror-lang-rdf/)

| Package | Languages |
| --- | --- |
| [@kurrawongai/codemirror-lang-turtle12](packages/lang-turtle12/README.md) | Turtle, TriG, N-Triples, N-Quads |
| [@kurrawongai/codemirror-lang-sparql12](packages/lang-sparql12/README.md) | SPARQL query and update |
| [@kurrawongai/codemirror-lang-srl](packages/lang-srl/README.md) | SRL |

These are editor parsers, not complete validators, and they accept some invalid
documents. SRL language support adds targeted conformance diagnostics for the
shared SPARQL grammar. N-Triples and N-Quads have no completion source.

### SRL features

The SRL package includes syntax-tree-based conversion between SRL `RULE` and
`DATA` blocks and the corresponding SPARQL `CONSTRUCT`, `INSERT`, or
`INSERT DATA` forms. It translates SRL `SET` and `NOT` to their SPARQL
equivalents and can convert them back where the mapping is well defined.

In an SRL editor it also reports SPARQL-only constructs such as `BIND` and
`FILTER NOT EXISTS` as errors. An opt-in helper adds actions to the diagnostic
tooltips for converting supported forms to their SRL equivalents, such as
`SET` and `NOT`. Conversion returns separate source text and never changes
the editor's language mode.

## Try it locally

Requires Node.js 22 and pnpm 9.15.0.

```sh
git clone https://github.com/kurrawong/codemirror-lang-rdf.git
cd codemirror-lang-rdf
pnpm install --frozen-lockfile
pnpm demo
```

Open the URL printed in the terminal. The demo has samples for all six languages
and a syntax-tree inspector.

## Use in an application

Install `codemirror` and the package for the language you use:

```sh
npm install codemirror @kurrawongai/codemirror-lang-sparql12
```

In a browser entry module processed by your application's bundler:

```js
import { basicSetup, EditorView } from 'codemirror';
import { sparql } from '@kurrawongai/codemirror-lang-sparql12';

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
- [Report an issue](https://github.com/kurrawong/codemirror-lang-rdf/issues).

## Licence

[MIT](LICENSE). See [NOTICE](NOTICE) for attribution. The Turtle and SPARQL grammars build on the approach used by
[aatauil/codemirror-lang-turtle](https://github.com/aatauil/codemirror-lang-turtle)
and [aatauil/codemirror-lang-sparql](https://github.com/aatauil/codemirror-lang-sparql),
both MIT. Vendored W3C tests use the W3C Test Suite License and W3C 3-clause BSD License.
