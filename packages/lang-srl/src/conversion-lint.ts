import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension, EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { srlConformanceDiagnosticsForTree } from './conformance';
export type { SrlConformanceDiagnostic } from './conformance';

/** A SPARQL BIND spelling that can be raised to SRL SET. */
export interface SparqlBindConversion {
  from: number;
  to: number;
  replacement: string;
  /** Whether the source already contains SET's BOUND guard. */
  hasBoundGuard: boolean;
}

/** A SPARQL FILTER NOT EXISTS statement that maps exactly to SRL NOT. */
export interface SparqlNotExistsConversion {
  from: number;
  to: number;
  replacement: string;
}

/** A SPARQL operation keyword that has an SRL rule or data-block spelling. */
export interface SparqlOperationConversion {
  from: number;
  to: number;
  replacement: string;
  message: string;
  actionName: string;
}

export interface SrlSparqlConversionLinterOptions {
  /** Offer a conversion action for invalid SPARQL BIND. */
  bindAction?: boolean;
  /** Offer a conversion action for invalid SPARQL FILTER NOT EXISTS. */
  notExistsAction?: boolean;
  /** Offer conversion actions for invalid SPARQL operation openings. */
  operationAction?: boolean;
}

/**
 * SPARQL forms accepted by the shared grammar but deliberately absent from
 * the SRL grammar. This is an SRL validity check, not optional conversion UI.
 */
export function srlConformanceDiagnostics(state: EditorState) {
  return srlConformanceDiagnosticsForTree(state.doc.toString(), syntaxTree(state));
}

function skipSpace(source: string, pos: number): number {
  while (pos < source.length && /\s/.test(source[pos])) pos++;
  if (source[pos] === '.') {
    pos++;
    while (pos < source.length && /\s/.test(source[pos])) pos++;
  }
  return pos;
}

function closingParen(source: string, open: number): number {
  let depth = 0;
  let quote = '';
  for (let pos = open; pos < source.length; pos++) {
    const char = source[pos];
    if (quote) {
      if (char === '\\') pos++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') depth++;
    if (char === ')' && --depth === 0) return pos;
  }
  return -1;
}

function assignmentParts(source: string, from: number, to: number): { expression: string; variable: string } | null {
  const inner = source.slice(from + 1, to);
  let depth = 0;
  let quote = '';
  for (let pos = 0; pos < inner.length - 1; pos++) {
    const char = inner[pos];
    if (quote) {
      if (char === '\\') pos++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (depth === 0 && /^\s+AS\s+/i.test(inner.slice(pos))) {
      const match = inner.slice(pos).match(/^\s+AS\s+([?$][\w\d\u00b7\u0300-\u036f\u203f-\u2040]+)\s*$/i);
      if (match) return { expression: inner.slice(0, pos).trim(), variable: match[1] };
    }
  }
  return null;
}

/**
 * Find SPARQL `BIND(expr AS ?name)` snippets in SRL, with an optional matching
 * `FILTER(BOUND(?name))` guard. SRL SET represents the guarded form.
 */
export function sparqlBindConversions(state: EditorState): SparqlBindConversion[] {
  const source = state.doc.toString();
  const tree = syntaxTree(state);
  const bindStarts = new Set<number>();
  tree.iterate({
    enter: (node) => {
      if (node.name === 'KwBIND') bindStarts.add(node.from);
    },
  });
  const found: SparqlBindConversion[] = [];
  const bind = /\bBIND\s*\(/gi;
  for (let match; (match = bind.exec(source));) {
    const from = match.index;
    if (!bindStarts.has(from)) continue;
    const open = source.indexOf('(', from);
    const close = closingParen(source, open);
    if (close < 0) continue;
    const parts = assignmentParts(source, open, close);
    if (!parts) continue;
    const guardFrom = skipSpace(source, close + 1);
    const guard = source.slice(guardFrom).match(/^FILTER\s*\(\s*BOUND\s*\(\s*([?$][\w\d\u00b7\u0300-\u036f\u203f-\u2040]+)\s*\)\s*\)/i);
    const hasBoundGuard = !!guard && guard[1] === parts.variable;
    found.push({
      from,
      to: hasBoundGuard ? guardFrom + guard![0].length : close + 1,
      replacement: `SET ( ${parts.variable} := ${parts.expression} )`,
      hasBoundGuard,
    });
    bind.lastIndex = close + 1;
  }
  return found;
}

/** Find direct SPARQL `FILTER NOT EXISTS { ... }` statements in an SRL body. */
export function sparqlNotExistsConversions(state: EditorState): SparqlNotExistsConversion[] {
  const source = state.doc.toString();
  const filters: { from: number; to: number }[] = [];
  const notExists: { from: number; to: number }[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'Filter') filters.push({ from: node.from, to: node.to });
      if (node.name === 'NotExistsFunc') notExists.push({ from: node.from, to: node.to });
    },
  });
  return filters.flatMap((filter) => {
    if (!notExists.some((node) => filter.from <= node.from && node.to <= filter.to)) return [];
    const match = source.slice(filter.from, filter.to).match(/^FILTER\s+NOT\s+EXISTS\s*({[\s\S]*})$/i);
    return match ? [{ from: filter.from, to: filter.to, replacement: `NOT ${match[1]}` }] : [];
  });
}

/** Find SPARQL CONSTRUCT and INSERT openings that can be raised directly to SRL. */
export function sparqlOperationConversions(state: EditorState): SparqlOperationConversion[] {
  const source = state.doc.toString();
  const found: SparqlOperationConversion[] = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'KwCONSTRUCT') {
        found.push({
          from: node.from,
          to: node.to,
          replacement: 'RULE',
          message: 'SPARQL CONSTRUCT is not valid SRL. Use RULE instead.',
          actionName: 'Convert SPARQL CONSTRUCT to SRL RULE',
        });
      }
      if (node.name === 'KwINSERT') {
        const after = skipSpace(source, node.to);
        const data = source.slice(after).match(/^DATA\b/i);
        found.push(data ? {
          from: node.from,
          to: after + data[0].length,
          replacement: 'DATA',
          message: 'SPARQL INSERT DATA is not valid SRL. Use DATA instead.',
          actionName: 'Convert SPARQL INSERT DATA to SRL DATA',
        } : {
          from: node.from,
          to: node.to,
          replacement: 'RULE',
          message: 'SPARQL INSERT is not valid SRL. Use RULE instead.',
          actionName: 'Convert SPARQL INSERT to SRL RULE',
        });
      }
    },
  });
  return found;
}

/**
 * CodeMirror diagnostics with a one-click conversion action for accidental
 * SPARQL BIND syntax in an SRL editor. Add this extension alongside `srl()`.
 */
export function srlSparqlConversionLinter(options: SrlSparqlConversionLinterOptions = {}): Extension {
  const bindAction = options.bindAction ?? true;
  const notExistsAction = options.notExistsAction ?? true;
  const operationAction = options.operationAction ?? true;
  const helpersEnabled = bindAction || notExistsAction || operationAction;
  return linter((view) => {
    const binds = sparqlBindConversions(view.state);
    const notExists = sparqlNotExistsConversions(view.state);
    const operations = sparqlOperationConversions(view.state);
    const diagnostics = srlConformanceDiagnostics(view.state).filter((diagnostic) =>
      !binds.some((bind) => bind.hasBoundGuard && bind.from < diagnostic.from && diagnostic.to <= bind.to)
    );
    return diagnostics.map((diagnostic): Diagnostic => {
      const bind = binds.find((conversion) => conversion.from === diagnostic.from);
      if (bind && bindAction) return {
        ...diagnostic,
        to: bind.to,
        severity: 'error',
        message: bind.hasBoundGuard
          ? 'This SPARQL BIND with FILTER(BOUND(...)) is equivalent to SRL SET.'
          : 'In SRL, SET is equivalent to SPARQL BIND together with FILTER(BOUND(...)).',
        actions: [{
          name: 'Convert SPARQL BIND to SRL SET',
          apply: (editor) => editor.dispatch({ changes: { from: bind.from, to: bind.to, insert: bind.replacement } }),
        }],
      };
      if (bind) return { ...diagnostic, severity: 'error', message: 'Syntax error.' };
      const negation = notExists.find((conversion) => diagnostic.from >= conversion.from && diagnostic.to <= conversion.to);
      if (negation && notExistsAction) return {
        from: negation.from,
        to: negation.to,
        severity: 'error',
        message: diagnostic.message,
        actions: [{
          name: 'Convert SPARQL FILTER NOT EXISTS to SRL NOT',
          apply: (editor) => editor.dispatch({ changes: { from: negation.from, to: negation.to, insert: negation.replacement } }),
        }],
      };
      if (negation) return { ...diagnostic, severity: 'error', message: 'Syntax error.' };
      const operation = operations.find((conversion) => conversion.from === diagnostic.from);
      if (operation && operationAction) return {
        from: operation.from,
        to: operation.to,
        severity: 'error',
        message: operation.message,
        actions: [{
          name: operation.actionName,
          apply: (editor) => editor.dispatch({ changes: { from: operation.from, to: operation.to, insert: operation.replacement } }),
        }],
      };
      if (operation) return { ...diagnostic, severity: 'error', message: 'Syntax error.' };
      return { ...diagnostic, severity: 'error', message: helpersEnabled ? diagnostic.message : 'Syntax error.' };
    });
  });
}
