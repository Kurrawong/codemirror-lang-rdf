import * as terms from './sparql.grammar.terms';

/**
 * SPARQL's keywords are case-insensitive and not reserved.
 *
 * `SELECT`, `select` and `SeLeCt` are the same keyword; `select:x` is a
 * prefixed name and `?select` is a variable, neither of which is a keyword at
 * all. That combination is why the grammar lexes one `Word` token and hands it
 * here rather than declaring 125 case-insensitive terminals: a terminal per
 * keyword would have to spell out every letter's two cases, and would then
 * overlap with `PNameLN` on every keyword that also starts a prefix.
 *
 * The keyword list is therefore not written twice. The grammar's specialize
 * block names one term per keyword as `Kw` + the keyword in upper case, and
 * this map is derived from those term names — so adding a keyword to the
 * grammar is the only edit needed, and a term that is declared but unreachable
 * is impossible to forget about.
 */
const BY_WORD: Record<string, number> = Object.create(null);

for (const [name, id] of Object.entries(terms as unknown as Record<string, number>)) {
  if (name.startsWith('Kw') && typeof id === 'number') BY_WORD[name.slice(2).toLowerCase()] = id;
}

/** The specializer the grammar calls for every `Word`. `-1` means "not a keyword". */
export function keyword(value: string): number {
  const found = BY_WORD[value.toLowerCase()];
  return found === undefined ? -1 : found;
}

/** Every keyword the grammar knows, lower-cased. Used by the highlight and completion tests. */
export const KEYWORDS: readonly string[] = Object.keys(BY_WORD).sort();

/** The node names the grammar gives keywords, for `styleTags`. */
export const KEYWORD_NODE_NAMES: readonly string[] = Object.keys(
  terms as unknown as Record<string, number>
)
  .filter((name) => name.startsWith('Kw'))
  .sort();
