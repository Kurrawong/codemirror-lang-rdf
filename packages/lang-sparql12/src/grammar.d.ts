/**
 * The rollup build turns `*.grammar` into a module exporting the compiled
 * parser (and `*.grammar.terms` into its term ids). TypeScript needs to be told
 * that, since it never sees the plugin.
 */
declare module '*.grammar' {
  import type { LRParser } from '@lezer/lr';
  export const parser: LRParser;
}
declare module '*.grammar.terms' {
  const terms: Record<string, number>;
  export = terms;
}
