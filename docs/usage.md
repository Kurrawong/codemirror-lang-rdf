# Usage

## Install from a checkout

The packages are not yet published on npm. Build local tarballs to install
them in an application. Requires Node.js 22 and pnpm 9.15.0.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run build
mkdir -p dist/packages
pnpm --dir packages/lang-turtle12 pack --pack-destination "$PWD/dist/packages"
pnpm --dir packages/lang-sparql12 pack --pack-destination "$PWD/dist/packages"
pnpm --dir packages/lang-srl pack --pack-destination "$PWD/dist/packages"
```

The filenames contain the versions in each package's `package.json`.
In your application directory, use npm to install the tarballs by absolute path.
For the current checkout versions:

```sh
npm install codemirror \
  /path/to/codemirror-lang-rdf/dist/packages/codemirror-lang-turtle12-0.1.0.tgz \
  /path/to/codemirror-lang-rdf/dist/packages/codemirror-lang-sparql12-0.1.0.tgz \
  /path/to/codemirror-lang-rdf/dist/packages/codemirror-lang-srl-0.1.0.tgz
```

Replace `/path/to/codemirror-lang-rdf` with your checkout path. You can omit
packages you do not use, but SRL requires the SPARQL package. Install both
tarballs together when using SRL; SPARQL is not available from npm yet.

This installation command uses npm. With pnpm 9, passing both tarballs still
attempts to fetch SRL's SPARQL dependency from the registry; a pnpm application
needs a local dependency override for that package.

Rebuild, repack, and reinstall the tarballs after changing the library.

## Create an editor

Use this in a browser entry module processed by a JavaScript bundler:

```js
import { basicSetup, EditorView } from 'codemirror';
import { sparql } from 'codemirror-lang-sparql12';

new EditorView({
  parent: document.body,
  doc: 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }',
  extensions: [basicSetup, sparql()],
});
```

`basicSetup` supplies the editor controls and a default highlight style.
The language extension supplies parsing, language data, and completion.

Choose one language extension for the document:

| Language | Package | Extension |
| --- | --- | --- |
| Turtle | `codemirror-lang-turtle12` | `turtle(options?)` |
| TriG | `codemirror-lang-turtle12` | `trig(options?)` |
| N-Triples | `codemirror-lang-turtle12` | `ntriples()` |
| N-Quads | `codemirror-lang-turtle12` | `nquads()` |
| SPARQL query or update | `codemirror-lang-sparql12` | `sparql(options?)` |
| SRL | `codemirror-lang-srl` | `srl(options?)` |

N-Triples and N-Quads use separate parser entry points that reject Turtle-only
syntax such as prefixed names and semicolon lists. They have no completion source.

## Supply prefixes for completion

Pass a prefix map or a synchronous function receiving the current `EditorState`:

```js
import { sparql } from 'codemirror-lang-sparql12';

const language = sparql({
  prefixSource: {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    ex: 'http://example.org/',
  },
});
```

Use `language` in the editor's extensions. The same option is available on
`turtle()`, `trig()`, and `srl()`. Map keys omit the colon; the default prefix
uses an empty string. Document declarations override supplied values.
Supplying a prefix offers its label for completion; it does not insert a
declaration, resolve IRIs, or make an undeclared prefix valid.

SPARQL completion includes query and update keywords, built-ins, document
variables, and prefixes. SRL uses query and SRL keywords, omitting update
keywords. Turtle and TriG offer directives, `a`, `true`, `false`, and prefixes;
TriG also offers `GRAPH`. Their completion lists currently omit `VERSION`.

Keyword suggestions are not restricted to syntactically valid positions.
Document variables are collected without scope analysis. Completion is
suppressed inside parsed comments, strings, version specifiers, and IRIs.
The additional check for unfinished strings is line-local, so an unfinished
multiline string can still receive suggestions on later lines.

## Handle SRL diagnostics

`srl({ tuples: false })` omits `TUPLE` from completion. Tuple syntax still
parses. Use `tupleRanges(state)` to locate tuples if your application needs to
report that the extension is disabled.

`variablesInDataBlocks(state)` locates variables in ground `DATA` blocks,
which the grammar also accepts. Both helpers return ranges; the application
must create and display diagnostics. See the [API reference](api.md#srl).

The packages do not execute queries or rules and do not provide full validation.
See [conformance](conformance.md) for the constraints they do not enforce.

## Customise highlighting

Use CodeMirror's `syntaxHighlighting()` with a `HighlightStyle` in your
editor extensions. All six languages use the shared [highlight tags](highlight-tags.md).
