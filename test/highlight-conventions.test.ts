import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { nquadsLanguage, ntriplesLanguage, trigLanguage, turtleLanguage } from '../packages/lang-turtle12/dist/index.js';
import { sparqlLanguage } from '../packages/lang-sparql12/dist/index.js';
import { srlLanguage } from '../packages/lang-srl/dist/index.js';
import { tagOf, tokenTags } from './harness';
import type { TagName } from './harness';
import { tags as t, tagHighlighter, highlightTree } from '@lezer/highlight';

/**
 * The single test behind `docs/highlight-tags.md`.
 *
 * §4 of the plan asked for the tag conventions to be "a single document and a
 * single test, not three copies that drift". This is that test: every row of
 * the table, asserted against every grammar that has the construct, so a tag
 * cannot change in one grammar without failing here.
 *
 * Each case gives a snippet per language it applies to, because the same
 * construct needs different surroundings in each: `:s :p :o` is a statement in
 * Turtle, a pattern in SPARQL and a rule body in SRL.
 */
const languages = {
  turtle: turtleLanguage.parser,
  trig: trigLanguage.parser,
  ntriples: ntriplesLanguage.parser,
  nquads: nquadsLanguage.parser,
  sparql: sparqlLanguage.parser,
  srl: srlLanguage.parser,
} as const;

type LanguageName = keyof typeof languages;

interface Row {
  /** The row of `docs/highlight-tags.md` this case is checking. */
  construct: string;
  tag: TagName;
  /** The token to look for, and the document to look for it in, per language. */
  cases: Partial<Record<LanguageName, { doc: string; token: string }>>;
}

/** Wrap a triple in what each language needs around it. */
const triple = (t: string) => ({
  turtle: `PREFIX ex: <http://e/>\n${t} .`,
  trig: `PREFIX ex: <http://e/>\nex:g { ${t} }`,
  sparql: `PREFIX ex: <http://e/>\nASK { ${t} }`,
  srl: `PREFIX ex: <http://e/>\nRULE {} WHERE { ${t} }`,
});

function tripleRow(construct: string, tag: TagName, t: string, token: string): Row {
  const docs = triple(t);
  return {
    construct,
    tag,
    cases: {
      turtle: { doc: docs.turtle, token },
      trig: { doc: docs.trig, token },
      sparql: { doc: docs.sparql, token },
      srl: { doc: docs.srl, token },
    },
  };
}

const rows: Row[] = [
  tripleRow('<iri>', 'url', 'ex:s <http://p> ex:o', '<http://p>'),
  tripleRow('prefix:local', 'namespace', 'ex:s ex:p ex:o', 'ex:p'),
  tripleRow('_:b', 'propertyName', '_:b ex:p ex:o', '_:b'),
  tripleRow('[]', 'propertyName', 'ex:s ex:p []', '[]'),
  tripleRow('String literal', 'string', 'ex:s ex:p "x"', '"x"'),
  tripleRow('Numeric literal', 'number', 'ex:s ex:p 42', '42'),
  tripleRow('@lang--dir', 'annotation', 'ex:s ex:p "x"@en--ltr', '@en--ltr'),
  tripleRow('^^datatype', 'typeName', 'ex:s ex:p "x"^^ex:t', 'ex:t'),
  tripleRow('^^', 'typeName', 'ex:s ex:p "x"^^ex:t', '^^'),
  tripleRow('<<(', 'tripleTermBracket', 'ex:s ex:p <<( ex:a ex:b ex:c )>>', '<<('),
  tripleRow(')>>', 'tripleTermBracket', 'ex:s ex:p <<( ex:a ex:b ex:c )>>', ')>>'),
  tripleRow('<<', 'reifiedTripleBracket', '<< ex:a ex:b ex:c >> ex:p ex:o', '<<'),
  tripleRow('>>', 'reifiedTripleBracket', '<< ex:a ex:b ex:c >> ex:p ex:o', '>>'),
  tripleRow('{|', 'annotationBrace', 'ex:s ex:p ex:o {| ex:q ex:r |}', '{|'),
  tripleRow('|}', 'annotationBrace', 'ex:s ex:p ex:o {| ex:q ex:r |}', '|}'),
  tripleRow('~', 'reifier', 'ex:s ex:p ex:o ~ex:r {| ex:q ex:r |}', '~'),
  tripleRow('[', 'squareBracket', 'ex:s ex:p [ ex:q ex:r ]', '['),
  tripleRow('(', 'paren', 'ex:s ex:p ( ex:a )', '('),
  tripleRow(';', 'separator', 'ex:s ex:p ex:o ; ex:q ex:r', ';'),
  tripleRow(',', 'separator', 'ex:s ex:p ex:o , ex:o2', ','),
  {
    construct: 'Comment',
    tag: 'comment',
    cases: {
      turtle: { doc: '# hi\nPREFIX ex: <http://e/>', token: '# hi' },
      trig: { doc: '# hi\nPREFIX ex: <http://e/>', token: '# hi' },
      ntriples: { doc: '# hi\n<http://s> <http://p> <http://o> .', token: '# hi' },
      nquads: { doc: '# hi\n<http://s> <http://p> <http://o> .', token: '# hi' },
      sparql: { doc: '# hi\nASK { }', token: '# hi' },
      srl: { doc: '# hi\nRULE {} WHERE {}', token: '# hi' },
    },
  },
  {
    construct: 'Keyword (PREFIX)',
    tag: 'keyword',
    cases: {
      turtle: { doc: 'PREFIX ex: <http://e/>', token: 'PREFIX' },
      trig: { doc: 'PREFIX ex: <http://e/>', token: 'PREFIX' },
      sparql: { doc: 'PREFIX ex: <http://e/>', token: 'PREFIX' },
      srl: { doc: 'PREFIX ex: <http://e/>', token: 'PREFIX' },
    },
  },
  {
    construct: 'Keyword (VERSION)',
    tag: 'keyword',
    cases: {
      turtle: { doc: 'VERSION "1.2"', token: 'VERSION' },
      trig: { doc: 'VERSION "1.2"', token: 'VERSION' },
      sparql: { doc: 'VERSION "1.2"', token: 'VERSION' },
    },
  },
  {
    construct: '?var / $var',
    tag: 'variableName',
    cases: {
      sparql: { doc: 'ASK { ?s ?p ?o }', token: '?s' },
      srl: { doc: 'RULE {} WHERE { ?s ?p ?o }', token: '?s' },
    },
  },
  {
    construct: '{ / }',
    tag: 'brace',
    cases: {
      trig: { doc: 'PREFIX ex: <http://e/>\nex:g { ex:s ex:p ex:o }', token: '{' },
      sparql: { doc: 'ASK { }', token: '{' },
      srl: { doc: 'RULE {} WHERE {}', token: '{' },
    },
  },
  {
    construct: 'true / false',
    tag: 'bool',
    cases: {
      turtle: { doc: 'PREFIX ex: <http://e/>\nex:s ex:p true .', token: 'true' },
      trig: { doc: 'PREFIX ex: <http://e/>\nex:g { ex:s ex:p true }', token: 'true' },
      sparql: { doc: 'PREFIX ex: <http://e/>\nASK { ex:s ex:p false }', token: 'false' },
      srl: { doc: 'PREFIX ex: <http://e/>\nRULE {} WHERE { ex:s ex:p true }', token: 'true' },
    },
  },
  {
    construct: 'Terminating .',
    tag: 'punctuation',
    cases: {
      turtle: { doc: 'PREFIX ex: <http://e/>\nex:s ex:p ex:o .', token: '.' },
      ntriples: { doc: '<http://s> <http://p> <http://o> .', token: '.' },
      nquads: { doc: '<http://s> <http://p> <http://o> <http://g> .', token: '.' },
      sparql: { doc: 'ASK { <http://s> <http://p> <http://o> . }', token: '.' },
      srl: { doc: 'RULE {} WHERE { <http://s> <http://p> <http://o> . }', token: '.' },
    },
  },
  {
    construct: ':= (SRL only)',
    tag: 'operator',
    cases: { srl: { doc: 'RULE {} WHERE { SET ( ?y := 1 ) }', token: ':=' } },
  },
  {
    construct: 'Comparison operator',
    tag: 'operator',
    cases: {
      sparql: { doc: 'ASK { FILTER(?a >= 1) }', token: '>=' },
      srl: { doc: 'RULE {} WHERE { FILTER(?a >= 1) }', token: '>=' },
    },
  },
  {
    construct: 'Arithmetic operator',
    tag: 'operator',
    cases: {
      sparql: { doc: 'ASK { FILTER(?a + 1 > 2) }', token: '+' },
      srl: { doc: 'RULE {} WHERE { FILTER(?a + 1 > 2) }', token: '+' },
    },
  },
];

describe.each(rows)('$construct is tagged $tag', ({ tag, cases }) => {
  const entries = Object.entries(cases) as [LanguageName, { doc: string; token: string }][];

  it('applies to at least one grammar', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)('in %s', (name, { doc, token }) => {
    const parser = languages[name];
    // A missing tag and a wrong tag are different failures; report which.
    const tags = tokenTags(parser, doc);
    expect(tags.map((t) => t.text)).toContain(token);
    expect(tagOf(parser, doc, token)).toBe(tag);
  });
});

describe('the table in docs/highlight-tags.md', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const doc = readFileSync(join(here, '..', 'docs', 'highlight-tags.md'), 'utf8');

  /*
   * The document is the specification, so a tag this test asserts but the
   * table does not mention would be an undocumented convention — the exact
   * drift §4 set out to prevent.
   */
  /*
   * The table writes the tag as the expression a style author would type;
   * these tests name it for readability. One explicit map, rather than letting
   * the two drift into separate vocabularies.
   */
  const TABLE_TAG_TO_NAME: Record<string, TagName> = {
    'special(angleBracket)': 'reifiedTripleBracket',
    'special(paren)': 'tripleTermBracket',
    'special(brace)': 'annotationBrace',
    'special(operator)': 'reifier',
  };
  const NAME_TO_TABLE_TAG = Object.fromEntries(
    Object.entries(TABLE_TAG_TO_NAME).map(([table, name]) => [name, table])
  ) as Record<string, string>;

  it('mentions every tag these tests assert', () => {
    const asserted = [...new Set(rows.map((r) => r.tag))].sort();
    const missing = asserted.filter((tag) => !doc.includes(`\`${NAME_TO_TABLE_TAG[tag] ?? tag}\``));
    expect(missing).toEqual([]);
  });

  it('asserts every tag the table lists', () => {
    const listed = [...doc.matchAll(/^\| [^|]+ \| `([a-zA-Z()]+)`/gm)].map(
      (m) => TABLE_TAG_TO_NAME[m[1]] ?? m[1]
    );
    const asserted = new Set(rows.map((r) => r.tag));
    // `invalid` is CodeMirror's own tag for error nodes, not one a grammar
    // assigns, so it is documented for style authors but has no row here.
    const missing = listed.filter((tag) => tag !== 'invalid' && !asserted.has(tag as TagName));
    expect(missing).toEqual([]);
  });
});

describe('a style that knows nothing about RDF 1.2 still colours it', () => {
  /*
   * The reason the 1.2 brackets are `special()` derivations rather than tags of
   * their own: `special(x)` falls back to `x`, and `angleBracket`, `paren` and
   * `brace` all fall back to `bracket`. So the distinction is available to a
   * style that wants it and invisible to one that does not — which is what
   * makes adding it a safe change for anyone already using these packages.
   */
  const plain = tagHighlighter([
    { tag: t.bracket, class: 'bracket' },
    { tag: t.operator, class: 'operator' },
  ]);

  const cases = [
    ['turtle', 'PREFIX ex: <http://e/>\nex:s ex:p <<( ex:a ex:b ex:c )>> , << ex:d ex:e ex:f >> ~ex:r {| ex:q ex:z |} .'],
    ['sparql', 'PREFIX ex: <http://e/>\nASK { ex:s ex:p <<( ex:a ex:b ex:c )>> , << ex:d ex:e ex:f >> ~ex:r {| ex:q ex:z |} }'],
  ] as const;

  it.each(cases)('in %s, every 1.2 delimiter falls back to bracket', (name, doc) => {
    const parser = languages[name];
    const seen = new Map<string, string>();
    highlightTree(parser.parse(doc), plain, (from, to, cls) => {
      seen.set(doc.slice(from, to), cls);
    });
    for (const token of ['<<(', ')>>', '<<', '>>', '{|', '|}'])
      expect(seen.get(token), `${token} in ${name}`).toBe('bracket');
    expect(seen.get('~'), `~ in ${name}`).toBe('operator');
  });
});
