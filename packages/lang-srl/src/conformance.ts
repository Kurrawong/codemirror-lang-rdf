import type { Tree } from '@lezer/common';

export interface SrlConformanceDiagnostic {
  from: number;
  to: number;
  message: string;
}

const UNSUPPORTED_BUILT_INS: Record<string, string> = {
  KwBOUND: 'BOUND',
  KwRAND: 'RAND',
  KwMD5: 'MD5',
  KwSHA1: 'SHA1',
  KwSHA256: 'SHA256',
  KwSHA384: 'SHA384',
  KwSHA512: 'SHA512',
  KwCOALESCE: 'COALESCE',
  KwDISTINCT: 'DISTINCT in a function call',
  KwCOUNT: 'COUNT',
  KwSUM: 'SUM',
  KwMIN: 'MIN',
  KwMAX: 'MAX',
  KwAVG: 'AVG',
  KwSAMPLE: 'SAMPLE',
  KwGROUP_CONCAT: 'GROUP_CONCAT',
};

/** SPARQL forms accepted by the shared parser but absent from SRL. */
export function srlConformanceDiagnosticsForTree(source: string, tree: Tree): SrlConformanceDiagnostic[] {
  const found: SrlConformanceDiagnostic[] = [];
  const add = (from: number, to: number, message: string) => found.push({ from, to, message });

  tree.iterate({
    enter: (node) => {
      if (node.name === 'KwBIND') {
        add(node.from, node.to, 'SPARQL BIND is not valid SRL. Use SET instead.');
      } else if (node.name === 'KwCONSTRUCT') {
        add(node.from, node.to, 'SPARQL CONSTRUCT is not valid SRL. Use RULE instead.');
      } else if (node.name === 'KwINSERT') {
        add(node.from, node.to, 'SPARQL INSERT is not valid SRL. Use RULE instead.');
      } else if (node.name === 'NotExistsFunc') {
        add(node.from, node.to, 'SPARQL FILTER NOT EXISTS is not valid SRL. Use NOT { ... } instead.');
        return false;
      } else if (node.name === 'ExistsFunc') {
        add(node.from, node.to, 'SPARQL EXISTS is not valid SRL.');
        return false;
      } else if (node.name === 'PathNegatedPropertySet') {
        add(node.from, node.to, 'Negated property paths are not valid SRL.');
        return false;
      } else if (node.name === 'PathMod') {
        add(node.from, node.to, 'Property path modifiers (?, *, +) are not valid SRL.');
      } else if (node.name === 'PathAlternative' && source.slice(node.from, node.to).includes('|')) {
        add(node.from, node.to, 'Alternative property paths (|) are not valid SRL.');
        return false;
      } else if (UNSUPPORTED_BUILT_INS[node.name]) {
        const name = UNSUPPORTED_BUILT_INS[node.name];
        add(node.from, node.to, `SPARQL ${name} is not valid SRL.`);
      }
    },
  });
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'SrlDataBlock') return;
      node.node.cursor().iterate((inner) => {
        if (inner.name === 'Var1' || inner.name === 'Var2')
          add(inner.from, inner.to, 'Variables are not valid in an SRL DATA block.');
      });
      return false;
    },
  });
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'Negation') return;
      node.node.cursor().iterate((inner) => {
        if (inner.from === node.from && inner.to === node.to) return;
        if (inner.name === 'Assignment')
          add(inner.from, inner.to, 'SET is not valid inside an SRL NOT body.');
        if (inner.name === 'Negation')
          add(inner.from, inner.to, 'Nested NOT is not valid inside an SRL NOT body.');
      });
      return false;
    },
  });
  return found;
}
