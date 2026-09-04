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
| `<<(`, `)>>`, `<<`, `>>`, `{\|`, `\|}`, `{`, `}` | `brace` |
| `[`, `]` | `squareBracket` |
| `(`, `)` | `paren` |
| `~`, `:=`, arithmetic and comparison operators | `operator` |
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

**Brackets are split three ways.** `squareBracket` and `paren` are separate from
`brace` because CodeMirror's own default style separates them, and a style that
wants them uniform can list all three in one rule — whereas a grammar that
tagged them all `brace` would make the distinction unrecoverable.

**`.` is `punctuation`, `;` and `,` are `separator`.** In Turtle the dot ends a
statement while the other two continue one, which is the same split
`@lezer/highlight` draws between the two tags.
