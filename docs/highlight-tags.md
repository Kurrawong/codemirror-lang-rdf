# Highlight tags

All six languages use the tags below from `@lezer/highlight`. Applications
can use one `HighlightStyle` across the packages. The packages do not define
colours.

[Highlight convention tests](../test/highlight-conventions.test.ts) check
representative constructs in the applicable languages and check that the
documented and tested tag sets agree.

| Construct | Tag |
| --- | --- |
| Keywords and built-in function names | `keyword` |
| `<iri>` | `url` |
| `prefix:local`, and `prefix:` in a declaration | `namespace` |
| `?var`, `$var` | `variableName` |
| `_:b`, `[]` | `propertyName` |
| String literals | `string` |
| Numeric literals | `number` |
| `true`, `false` | `bool` |
| `^^datatype` | `typeName` |
| `@lang`, `@lang--dir` | `annotation` |
| `{`, `}` | `brace` |
| `[`, `]` | `squareBracket` |
| `(`, `)` | `paren` |
| `<<`, `>>` (reified triple) | `special(angleBracket)` |
| `<<(`, `)>>` (triple term) | `special(paren)` |
| `{\|`, `\|}` (annotation block) | `special(brace)` |
| `~` (reifier) | `special(operator)` |
| Tokens within reified triples, triple terms, and annotation blocks | `quote`, in addition to their own tags |
| `:=`, arithmetic and comparison operators | `operator` |
| `;`, `,` | `separator` |
| `.` | `punctuation` |
| Comments | `comment` |

## Style RDF 1.2 delimiters

This browser entry module defines separate colours for reified-triple,
triple-term, and annotation delimiters. Install `codemirror`,
`@codemirror/language`, and `@lezer/highlight` alongside the language package.

```js
import { basicSetup, EditorView } from 'codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { turtle } from 'codemirror-lang-turtle12';

const rdfStyle = HighlightStyle.define([
  { tag: t.special(t.angleBracket), color: '#9c304b' },
  { tag: t.special(t.paren), color: '#176b50' },
  { tag: t.special(t.brace), color: '#6850a1' },
  { tag: t.special(t.operator), color: '#9c304b' },
]);

new EditorView({
  parent: document.body,
  doc: 'PREFIX ex: <http://example.org/>\nex:s ex:p <<( ex:a ex:b ex:c )>> .',
  extensions: [
    basicSetup,
    turtle(),
    syntaxHighlighting(rdfStyle),
  ],
});
```

This style only assigns colours to the listed tags. Add rules for other tags
when defining a complete theme.

## Style construct contents

Tokens within reified triples, triple terms, and annotation blocks also carry
`quote`. For example, an IRI retains `url` while receiving `quote`. Add a rule
such as `{ tag: t.quote, backgroundColor: '#eef3f0' }` to `HighlightStyle.define()`
to shade these constructs. A style without a `quote` rule retains its existing
output; the highlight convention tests check this behaviour.

All three constructs share the region tag. For custom parser props, the
packages export `turtleProps` and `sparqlProps`; see [API reference](api.md).

## Tag behaviour

`special(x)` derives from `x`. A rule for `bracket` covers the RDF 1.2
delimiters through their `angleBracket`, `paren`, and `brace` parents.
A rule for `operator` covers `~`. Rules for the specific `special(...)` tags
allow different colours for those constructs.

`url` and `namespace` distinguish the written forms of IRIs and prefixed
names. They can denote the same IRI; applications can assign them the same
colour. Datatype IRIs and prefixed names following `^^` use `typeName`,
as does the `^^` marker.

Blank nodes use `propertyName`. Ordinary braces, square brackets, and
parentheses have separate tags. A Turtle statement's terminating dot uses
`punctuation`; semicolons and commas use `separator`.
