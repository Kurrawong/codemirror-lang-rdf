# Highlight tags

The three grammars in this repository tag the same construct with the same
`@lezer/highlight` tag, so an application can keep **one** `HighlightStyle` for
Turtle, TriG, N-Triples, N-Quads, SPARQL and SRL. A style written against this
table will not need a per-language variant.

The table is not documentation of what the code happens to do: it is the
specification the code is tested against. `test/highlight-conventions.test.ts`
asserts every row below against every grammar that has the construct, so a tag
cannot drift in one grammar without failing the build.

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
| `<<`, `>>` — a reified triple | `special(angleBracket)` |
| `<<(`, `)>>` — a triple term | `special(paren)` |
| `{\|`, `\|}` — an annotation block | `special(brace)` |
| `~` — a reifier | `special(operator)` |
| `:=`, arithmetic and comparison operators | `operator` |
| `;`, `,` | `separator` |
| `.` | `punctuation` |
| Comments | `comment` |

## Notes on the choices

**An IRI and a prefixed name are tagged differently but denote the same thing.**
`url` and `namespace` are separate rows so a style *may* distinguish them; the
app this was built for deliberately colours them the same, because `:rel` and
`<http://ex/rel>` name the same predicate and colouring them differently would
suggest otherwise.

**A blank node is `propertyName`.** Not an obvious choice on its own — it is the
tag the `@codemirror/legacy-modes` Turtle mode used, and keeping it means an
existing style keeps working when it swaps that mode for these grammars.

**A datatype IRI is `typeName`, not `url`.** Inside `^^…` the IRI qualifies the
literal rather than being a term the document is about, so it takes the
de-emphasised tag. The grammars implement this with a parent-path rule
(`Datatype/IRIRef`), which is more specific than the bare token rule and
therefore wins.

**Brackets are split, and the RDF 1.2 ones are split further.** `squareBracket`
and `paren` are separate from `brace` because CodeMirror's own default style
separates them, and a style that wants them uniform can list all three in one
rule — whereas a grammar that tagged them all `brace` would make the
distinction unrecoverable.

The same argument applies with more force to the 1.2 term brackets.
`<< s p o >>` and `<<( s p o )>>` differ by one character and mean quite
different things — a statement you can refer to, versus an object that *is* a
triple — so a style that cannot separate them cannot help a reader see the
difference. Each is tagged `special()` of the standard tag its glyphs actually
are:

```js
import { tags as t } from '@lezer/highlight';

HighlightStyle.define([
  { tag: t.special(t.angleBracket), color: 'var(--reified)' },   // << … >>
  { tag: t.special(t.paren),        color: 'var(--tripleterm)' },// <<( … )>>
  { tag: t.special(t.brace),        color: 'var(--annotation)' },// {| … |}
  { tag: t.special(t.operator),     color: 'var(--reifier)' },   // ~
]);
```

**Nothing has to know about this.** `special(x)` derives from `x`, and
`angleBracket`, `paren` and `brace` all derive from `bracket`, so a style that
handles only `bracket` — or only `brace`, `paren` and `angleBracket` — colours
every one of them with no change. The specific tags are there for a style that
wants the distinction, not a requirement on one that does not. That fallback is
asserted in `test/highlight-conventions.test.ts` alongside the table itself.

**`.` is `punctuation`, `;` and `,` are `separator`.** In Turtle the dot ends a
statement while the other two continue one, which is the same split
`@lezer/highlight` draws between the two tags.
