# API reference

All packages export ES modules, CommonJS modules, and TypeScript declarations
from their package root. The language functions return CodeMirror
`LanguageSupport`; the named language objects are `LRLanguage` instances.

## Shared completion types

Each package exports these types:

```ts
import type { EditorState } from '@codemirror/state';

type PrefixMap = Record<string, string>;
type PrefixSource = PrefixMap | ((state: EditorState) => PrefixMap);
interface CompletionOptions {
  prefixSource?: PrefixSource;
}
```

The default options object is `{}`. Prefix keys omit the colon.
Document declarations take precedence over `prefixSource`.

| Helper | Result |
| --- | --- |
| `documentPrefixes(state)` | `PrefixMap` read from the syntax tree |
| `knownPrefixes(state, options?)` | Supplied prefixes overlaid with document declarations |
| `documentVariables(state)` | Sorted, unique variable spellings, including `?` or `$`; SPARQL and SRL only |

Prefix helpers return IRI text without angle brackets. They do not resolve
relative IRIs or decode escapes. Variable collection does not check scope.
Use the helpers with an `EditorState` configured for the appropriate language.

## Turtle, TriG, N-Triples, and N-Quads

Import from `@kurrawongai/codemirror-lang-turtle12`.

| Export | Behaviour |
| --- | --- |
| `turtle(options?)`, `trig(options?)` | Language support with completion |
| `ntriples()`, `nquads()` | Language support without completion |
| `turtleLanguage`, `trigLanguage`, `ntriplesLanguage`, `nquadsLanguage` | Languages with highlight, fold, indent, and language data |
| `parser` | Raw Lezer `LRParser`, without editor props |
| `turtleProps` | Shared highlight, fold, and indent node props |
| `turtleHighlighting` | Highlight node prop for manual parser configuration |
| `turtleCompletionSource(options?, dialect?)` | Standalone completion source; dialect is `'turtle'` (default) or `'trig'` |
| `documentPrefixes`, `knownPrefixes` | Prefix helpers described above |

For raw parsing, select `TurtleDoc`, `TrigDoc`, `NTriplesDoc`, or `NQuadsDoc`:

```js
import { parser } from '@kurrawongai/codemirror-lang-turtle12';

const tree = parser.configure({ top: 'NTriplesDoc' })
  .parse('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
```

For parsing with editor props, use the corresponding language's `.parser`.

## SPARQL

Import from `@kurrawongai/codemirror-lang-sparql12`.

| Export | Behaviour |
| --- | --- |
| `sparql(options?)` | SPARQL query and update language support with completion |
| `sparqlLanguage` | Language with highlight, fold, indent, and language data |
| `parser` | Raw Lezer `LRParser`; top rules are `SparqlUnit` and `SrlUnit` |
| `sparqlProps` | Shared highlight, fold, and indent node props |
| `sparqlHighlighting` | Highlight node prop alone |
| `sparqlCompletionSource(options?)` | Standalone completion source |
| `sparqlKeywords`, `sparqlFunctions`, `srlKeywords` | Readonly arrays of completion spellings |
| `KEYWORDS` | Sorted lowercase keywords derived from generated grammar terms |
| `KEYWORD_NODE_NAMES` | Sorted keyword node names, such as `KwSELECT` |
| `documentPrefixes`, `knownPrefixes`, `documentVariables` | Helpers described above |

`sparql()` takes `CompletionOptions`. The standalone completion source takes
the additional exported type `CompletionSourceOptions`:

```ts
interface CompletionSourceOptions extends CompletionOptions {
  dialect?: 'sparql' | 'srl';
}
```

The default dialect is `'sparql'`. `sparql()` always selects SPARQL completion.
To parse without an editor, use `parser.configure({ top: 'SparqlUnit' }).parse(text)`.

## SRL

Import from `@kurrawongai/codemirror-lang-srl`.

| Export | Behaviour |
| --- | --- |
| `srl(options?)` | SRL language support with completion |
| `srlLanguage` | SRL language with editor props and language data |
| `parser` | Shared SPARQL parser configured for `SrlUnit`, without editor props |
| `ruleRanges(state)` | `{ from, to }[]` for `Rule` nodes, in document order |
| `dataBlockRanges(state)` | `{ from, to }[]` for `SrlDataBlock` nodes, in document order |
| `tupleRanges(state)` | `TupleRange[]` for tuples in rule heads and bodies |
| `variablesInDataBlocks(state)` | `{ from, to, name }[]` for variables in ground data blocks; names include `?` or `$` |
| `documentPrefixes`, `knownPrefixes`, `documentVariables`, `srlKeywords` | Re-exports from the SPARQL package |

The package also exports `SrlOptions` and `TupleRange`:

```ts
interface SrlOptions extends CompletionOptions {
  tuples?: boolean;
}

interface TupleRange {
  from: number;
  to: number;
  kind: 'TupleTemplate' | 'TuplePattern';
}
```

`tuples` defaults to `true`. Setting it to `false` only removes `TUPLE` from
completion. It does not change parsing or produce diagnostics.

Ranges use CodeMirror document offsets: `from` is inclusive and `to` is
exclusive. `TupleTemplate` identifies a tuple in a rule head; `TuplePattern`
identifies one in a rule body. Helpers inspect the current syntax tree and
return an empty array when it contains no matching nodes. They do not force
parsing of the whole document, which matters for large documents parsed in
the background.

## Syntax tree names

Production nodes use specification vocabulary, including `Triples`,
`PredicateObjectList`, `GroupGraphPattern`, `TripleTerm`, `ReifiedTriple`,
`QuadPattern`, `Rule`, and `HeadTemplate`.

SRL ground data blocks use `SrlDataBlock`; `DataBlock` is reserved for SPARQL
`VALUES` data. SPARQL expression trees include intermediate productions such
as `ConditionalOrExpression` and `UnaryExpression`. Find nodes by name rather
than assuming a fixed depth.

Keyword nodes use `Kw` followed by the uppercase spelling, such as `KwSELECT`
and `KwGROUP_CONCAT`. See [development](development.md#grammar-structure)
for the shared grammar and keyword implementation.
