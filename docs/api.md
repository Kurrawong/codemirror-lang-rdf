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

## Parse errors

The Turtle and SPARQL packages export `parseErrors(state)` and
`parseErrorLinter()`; the SRL package re-exports `parseErrors(state)`. Every
language support function in these packages includes a linter that underlines
parse errors. The functions have no option to leave it out.

```ts
interface ParseError {
  from: number;
  to: number;
  message: string;
}
```

`parseErrors(state)` returns `ParseError[]` in document order, one for each
error node in the syntax tree. Error nodes separated only by whitespace or `#`
comments are merged into one error, so `this is a test` is one error rather than
four. An error with `from` equal to `to` marks a point where a token is missing;
its message is `Syntax error.` Other messages quote the unexpected text,
shortened to 32 characters.

An incomplete parse ends in error nodes that are not in the document, so
`parseErrors` completes the parse first. It allows one second for this and
returns an empty array if the parse does not finish in that time.

`srl()` reports parse errors and SRL conformance errors through one linter. It
leaves out a parse error that overlaps an SRL diagnostic, because the SRL
message describes the same text.

## Formatting

Each package exports a formatter function and a CodeMirror command:

| Package | Function | Command |
| --- | --- | --- |
| `codemirror-lang-turtle12` | `formatTurtle(text, { dialect?, indent? })` | `formatTurtleDocument` |
| `codemirror-lang-sparql12` | `formatSparql(text, { lateral?, indent? })` | `formatSparqlDocument` |
| `codemirror-lang-srl` | `formatSrl(text, { indent? })` | `formatSrlDocument` |

The functions do not use `@codemirror/view` and run in Node. Each returns a
`FormatResult`:

```ts
interface FormatResult {
  text: string;
  changes: { from: number; to: number; insert: string }[];
  error: { from: number; to: number; message: string } | null;
}
```

`changes` are the edits, in input offsets, that turn the input into `text`.
`indent` is the text of one indent level and defaults to two spaces.
`dialect` is `'turtle'` (default) or `'trig'`; use `'trig'` for a document with
`GRAPH` blocks, which the Turtle grammar reads as an error. `lateral: true`
parses with the `lateral` dialect described under [SPARQL](#sparql).
`formatSrl` has no `tuples` option, because `tuples` does not change what
parses.

A formatter changes only the whitespace between tokens, and trailing spaces at
the end of a comment. Comments, the order of prefixes and the text of every
token are kept, so `1.0`, `LIMIT 0001` and `VALUES ?x { UNDEF }` come back as
written. Where the formatter starts a new line and the input had a blank line
at that point, it writes one blank line, except directly after an opening
brace or bracket and before a closing one. If the input has a parse error, the function returns the input
unchanged with `error` set to the first error node and `changes` empty. It does
the same if the output does not parse to the same tokens as the input; this
check guards against a layout rule that would join two tokens.

The layout:

- Turtle and TriG: one directive per line and each subject on its own line.
  After a `;` the next predicate goes on a new line one level deeper, and after
  a `,` the next object goes one level deeper again. `[ ]` and `{| |}` stay on
  one line unless their content has a `;` list, a `,` list or a comment.
  A TriG graph block indents its statements.
- SPARQL: one prologue declaration per line. Each clause (`SELECT`,
  `CONSTRUCT`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, `OFFSET`,
  `VALUES`) and each update operation starts a line. Each `{ }` group indents
  one level, and each pattern in a group starts a line. `} UNION {` stays on one
  line. A `VALUES` table with more than one row puts each row on its own line.
  Triple patterns follow the Turtle layout. Expressions stay on one line, with
  one space around operators and none inside parentheses or between a function
  name and its `(`.
- SRL: the SPARQL layout, with each `RULE`, `DATA` block and rule `WHERE` on its
  own line and the rule head and body indented one level.

N-Triples, N-Quads and RDF Patch have no formatter.

The commands are `StateCommand`s for a keymap. Each one formats the whole
document in one transaction with the user event `format`, using the editor's
`indentUnit`. It returns `false` and changes nothing when the editor's language
is not one it formats or when the document has a parse error.

`formatTurtle` and `formatSparql` lay out a document with `turtleLayout` and
`sparqlLayout`, which are also exported. `sparqlFormatter(parser)` returns a
formatter with the SPARQL layout over any configuration of the SPARQL
parser; `formatSrl` is `sparqlFormatter` over `SrlUnit`.

## Turtle, TriG, N-Triples, N-Quads, and RDF Patch

Import from `@kurrawongai/codemirror-lang-turtle12`.

| Export | Behaviour |
| --- | --- |
| `turtle(options?)`, `trig(options?)` | Language support with completion |
| `ntriples()`, `nquads()`, `rdfPatch()` | Language support without completion |
| `turtleLanguage`, `trigLanguage`, `ntriplesLanguage`, `nquadsLanguage`, `rdfPatchLanguage` | Languages with highlight, fold, indent, and language data |
| `parser` | Raw Lezer `LRParser`, without editor props |
| `turtleProps` | Shared highlight, fold, and indent node props |
| `turtleHighlighting` | Highlight node prop for manual parser configuration |
| `turtleCompletionSource(options?, dialect?)` | Standalone completion source; dialect is `'turtle'` (default) or `'trig'` |
| `documentPrefixes`, `knownPrefixes` | Prefix helpers described above |
| `parseErrors(state)`, `parseErrorLinter()` | Parse-error helpers described above |
| `formatTurtle`, `formatTurtleDocument`, `turtleLayout` | Formatter, command and layout rules described above |

For raw parsing, select `TurtleDoc`, `TrigDoc`, `NTriplesDoc`, `NQuadsDoc`, or `RdfPatchDoc`:

```js
import { parser } from '@kurrawongai/codemirror-lang-turtle12';

const tree = parser.configure({ top: 'NTriplesDoc' })
  .parse('<http://example.org/s> <http://example.org/p> <http://example.org/o> .');
```

For parsing with editor props, use the corresponding language's `.parser`.

### RDF Patch syntax tree

| Row | Node |
| --- | --- |
| `H key value .` | `Header(KwH, HeaderKey, value)` |
| `TX .` ... `TC .` or `TA .` | `Transaction(TxBegin, ..., TxCommit or TxAbort)` |
| `PA prefix <iri> .` | `PrefixAdd(KwPA, PatchPrefix or String, IRIRef)` |
| `PD prefix .` | `PrefixDelete(KwPD, PatchPrefix or String)` |
| `A s p o g? .` | `QuadAdd(KwA, terms..., GraphLabel?)` |
| `D s p o g? .` | `QuadDelete(KwD, terms..., GraphLabel?)` |

Rows take N-Quads terms. A prefixed name in an `A` or `D` row is a parse error,
because `PA` changes the prefixes of the target dataset and does not abbreviate
later rows. Headers may appear at the top level before each transaction.
A transaction folds between its `TX .` and `TC .` rows.

## SPARQL

Import from `@kurrawongai/codemirror-lang-sparql12`.

| Export | Behaviour |
| --- | --- |
| `sparql(options?)` | SPARQL query and update language support with completion |
| `sparqlLanguage` | Language with highlight, fold, indent, and language data |
| `sparqlLateralLanguage` | `sparqlLanguage` with the `lateral` dialect, which accepts `LATERAL` |
| `parser` | Raw Lezer `LRParser`; top rules are `SparqlUnit` and `SrlUnit` |
| `sparqlProps` | Shared highlight, fold, and indent node props |
| `sparqlHighlighting` | Highlight node prop alone |
| `sparqlCompletionSource(options?)` | Standalone completion source |
| `sparqlKeywords`, `sparqlFunctions`, `srlKeywords` | Readonly arrays of completion spellings |
| `KEYWORDS` | Sorted lowercase keywords derived from generated grammar terms |
| `KEYWORD_NODE_NAMES` | Sorted keyword node names, such as `KwSELECT` |
| `documentPrefixes`, `knownPrefixes`, `documentVariables` | Helpers described above |
| `parseErrors(state)`, `parseErrorLinter()` | Parse-error helpers described above |
| `formatSparql`, `formatSparqlDocument`, `sparqlFormatter`, `sparqlLayout` | Formatter, command and layout rules described above |

`sparql()` takes `SparqlOptions`:

```ts
interface SparqlOptions extends CompletionOptions {
  lateral?: boolean;
}
```

`lateral: true` accepts `A LATERAL { B }` from
[SEP-0006](https://github.com/w3c/sparql-dev/blob/main/SEP/SEP-0006/sep-0006.md).
LATERAL is not in the SPARQL 1.2 Working Draft, so it is off by default. With
it on, the editor parses `LATERAL` as a `LateralGraphPattern` node, highlights
it as a keyword, folds its group, and offers it in completion. With it off,
`LATERAL` is a parse error. Either way, `lateral:x` and `?lateral` stay a
prefixed name and a variable. To parse without an editor, use
`parser.configure({ top: 'SparqlUnit', dialect: 'lateral' })`. SRL has no
LATERAL, and the SRL language never enables the dialect.

The standalone completion source takes the additional exported type
`CompletionSourceOptions`:

```ts
interface CompletionSourceOptions extends CompletionOptions {
  dialect?: 'sparql' | 'srl';
  lateral?: boolean;
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
| `formatSrl(text, options?)`, `formatSrlDocument` | Formatter and command described above |
| `documentPrefixes`, `knownPrefixes`, `documentVariables`, `parseErrors`, `srlKeywords` | Re-exports from the SPARQL package |

The package also exports `SrlOptions` and `TupleRange`:

```ts
interface SrlOptions extends CompletionOptions {
  tuples?: boolean;
  sparqlConversions?: boolean;
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
`QuadPattern`, `Rule`, `HeadTemplate`, and `GroupAggregate`.

SRL ground data blocks use `SrlDataBlock`; `DataBlock` is reserved for SPARQL
`VALUES` data. SPARQL expression trees include intermediate productions such
as `ConditionalOrExpression` and `UnaryExpression`. Find nodes by name rather
than assuming a fixed depth.

Keyword nodes use `Kw` followed by the uppercase spelling, such as `KwSELECT`
and `KwGROUP_CONCAT`. See [development](development.md#grammar-structure)
for the shared grammar and keyword implementation.
