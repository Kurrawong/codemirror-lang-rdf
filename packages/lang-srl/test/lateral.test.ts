import { describe, expect, it } from 'vitest';
import { parser, srl } from '../dist/index.js';
import { completionLabels, completionsAt } from '../../../test/editor';
import { parsesCleanly } from '../../../test/harness';

/**
 * SRL has no LATERAL. The shared grammar's `lateral` dialect is something only
 * the SPARQL language can enable; SRL must read the word exactly as before.
 */
describe('LATERAL in SRL', () => {
  it('is an error in a rule body', () => {
    expect(parsesCleanly(parser, 'RULE { ?s ?p ?o } WHERE { ?s ?p ?o LATERAL { ?s ?q ?r } }')).toBe(false);
  });

  it('is an error inside FILTER EXISTS, which reaches SPARQL’s group pattern', () => {
    expect(
      parsesCleanly(parser, 'RULE { ?s ?p ?o } WHERE { ?s ?p ?o FILTER EXISTS { ?s ?q ?r LATERAL { ?r ?x ?y } } }')
    ).toBe(false);
  });

  it('still allows the word as a prefix and a variable', () => {
    expect(
      parsesCleanly(parser, 'PREFIX lateral: <http://example.org/> RULE { ?lateral lateral:p 1 } WHERE { ?lateral ?p ?o }')
    ).toBe(true);
  });

  it('is not offered in completion', async () => {
    const doc = 'RULE { ?s ?p ?o } WHERE { ?s ?p ?o LAT';
    expect(completionLabels(await completionsAt(doc, srl()))).not.toContain('LATERAL');
  });
});
