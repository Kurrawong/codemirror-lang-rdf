import type { Tree } from '@lezer/common';
import { parser as sparqlParser } from '@kurrawongai/codemirror-lang-sparql12';
import { srlConformanceDiagnosticsForTree } from './conformance';

const srlParser = sparqlParser.configure({ top: 'SrlUnit' });

/** A problem that prevents a lossless conversion. Offsets are document offsets. */
export interface ConversionDiagnostic {
  from: number;
  to: number;
  message: string;
}

/** The result of a conversion. `text` is present only when there are no diagnostics. */
export interface ConversionResult {
  text?: string;
  diagnostics: ConversionDiagnostic[];
}

export type SrlExportForm = 'construct' | 'insert';

export interface SrlToSparqlOptions {
  /** `construct` is a query; `insert` produces a SPARQL Update. */
  form?: SrlExportForm;
}

interface Span {
  name: string;
  from: number;
  to: number;
}

function spans(tree: Tree): Span[] {
  const found: Span[] = [];
  tree.iterate({
    enter: (node) => {
      found.push({ name: node.name, from: node.from, to: node.to });
    },
  });
  return found;
}

function errors(tree: Tree): ConversionDiagnostic[] {
  const found: ConversionDiagnostic[] = [];
  tree.iterate({
    enter: (node) => {
      if (node.type.isError)
        found.push({ from: node.from, to: node.to, message: 'Fix the syntax error before converting.' });
    },
  });
  return found;
}

function checkedSparqlResult(text: string, sourceRange: Span): ConversionResult {
  const targetDiagnostics = errors(sparqlParser.configure({ top: 'SparqlUnit' }).parse(text));
  return targetDiagnostics.length
    ? {
        diagnostics: [{
          from: sourceRange.from,
          to: sourceRange.to,
          message: `Conversion would produce invalid SPARQL: ${targetDiagnostics[0].message}`,
        }],
      }
    : { text, diagnostics: [] };
}

function checkedSrlResult(text: string, sourceRange: Span): ConversionResult {
  const tree = srlParser.parse(text);
  const targetDiagnostics = errors(tree);
  if (!targetDiagnostics.length) targetDiagnostics.push(...srlConformanceDiagnosticsForTree(text, tree));
  return targetDiagnostics.length
    ? {
        diagnostics: [{
          from: sourceRange.from,
          to: sourceRange.to,
          message: `Conversion would produce invalid SRL: ${targetDiagnostics[0].message}`,
        }],
      }
    : { text, diagnostics: [] };
}

function within(all: Span[], outer: Span, name: string): Span[] {
  return all.filter((node) => node.name === name && outer.from <= node.from && node.to <= outer.to);
}

function replace(text: string, changes: { from: number; to: number; insert: string }[]): string {
  return changes
    .sort((a, b) => b.from - a.from)
    .reduce((result, change) => result.slice(0, change.from) + change.insert + result.slice(change.to), text);
}

function removalSpan(source: string, from: number, to: number): { from: number; to: number } {
  const lineStart = source.lastIndexOf('\n', from - 1) + 1;
  const newline = source.indexOf('\n', to);
  const lineEnd = newline < 0 ? source.length : newline;
  if (!source.slice(lineStart, from).trim() && !source.slice(to, lineEnd).trim())
    return { from: lineStart, to: newline < 0 ? lineEnd : newline + 1 };
  return { from, to };
}

function unsupported(all: Span[], outer: Span, names: string[]): ConversionDiagnostic[] {
  return all
    .filter((node) => outer.from <= node.from && node.to <= outer.to && names.includes(node.name) && node.to > node.from)
    .map((node) => ({ from: node.from, to: node.to, message: `${node.name} cannot be represented in SRL.` }));
}

function expandRuleIri(source: string, ruleName: Span): string {
  const name = source.slice(ruleName.from, ruleName.to);
  if (name.startsWith('<')) return name;
  const colon = name.indexOf(':');
  if (colon < 0) return name;
  const prefix = name.slice(0, colon);
  const local = name.slice(colon + 1).replace(/\\([_~.!$&'()*+,;=/?#@%\-])/g, '$1');
  const declaration = new RegExp(`^\\s*PREFIX\\s+${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*<([^>]*)>`, 'im');
  const match = source.match(declaration);
  return match ? `<${match[1]}${local}>` : name;
}

/**
 * Lower one simple SRL rule or DATA block to SPARQL.
 *
 * `SET ( ?x := expr )` becomes `BIND(expr AS ?x) FILTER(BOUND(?x))` and bare
 * `NOT { ... }` becomes `FILTER NOT EXISTS { ... }`. The source is never
 * guessed at: SRL constructs without a SPARQL query equivalent return ranges
 * suitable for CodeMirror diagnostics instead.
 */
export function srlToSparql(source: string, options: SrlToSparqlOptions = {}): ConversionResult {
  const tree = srlParser.parse(source);
  const diagnostics = srlConformanceDiagnosticsForTree(source, tree);
  if (diagnostics.length) return { diagnostics };
  diagnostics.push(...errors(tree));
  if (diagnostics.length) return { diagnostics };

  const all = spans(tree);
  const rules = all.filter((node) => node.name === 'Rule');
  const data = all.filter((node) => node.name === 'SrlDataBlock');
  const form = options.form ?? 'construct';
  if (rules.length + data.length !== 1)
    diagnostics.push({ from: 0, to: source.length, message: 'Export exactly one SRL RULE or DATA block at a time.' });
  if (diagnostics.length) return { diagnostics };

  if (data.length === 1) {
    const block = data[0];
    const template = within(all, block, 'DataTemplate')[0];
    if (!template)
      return { diagnostics: [{ from: block.from, to: block.to, message: 'This DATA block cannot be converted.' }] };
    const prologue = source.slice(0, block.from);
    const triples = source.slice(template.from, template.to);
    const text = form === 'construct'
      ? `${prologue}CONSTRUCT ${triples} WHERE {}\n`
      : `${prologue}INSERT DATA ${triples}\n`;
    return checkedSparqlResult(text, block);
  }

  const rule = rules[0];
  const heads = within(all, rule, 'HeadTemplate');
  const bodies = within(all, rule, 'BodyPattern');
  const headStart = heads[0]?.from ?? rule.to;
  const ruleName = all.find((node) =>
    node.from > rule.from && node.to <= headStart && (node.name === 'IRIRef' || node.name === 'PNameLN' || node.name === 'PNameNS')
  );
  const tuples = [...within(all, rule, 'TupleTemplate'), ...within(all, rule, 'TuplePattern')];
  for (const tuple of tuples)
    diagnostics.push({ from: tuple.from, to: tuple.to, message: 'TUPLE has no SPARQL graph-pattern equivalent.' });
  const body = bodies.reduce<Span | undefined>((outer, candidate) => !outer || candidate.to - candidate.from > outer.to - outer.from ? candidate : outer, undefined);
  if (heads.length !== 1 || !body) {
    diagnostics.push({ from: rule.from, to: rule.to, message: 'This rule does not have one convertible head and body.' });
    return { diagnostics };
  }
  if (diagnostics.length) return { diagnostics };

  const changes: { from: number; to: number; insert: string }[] = [];
  for (const assignment of within(all, body, 'Assignment')) {
    const variable = within(all, assignment, 'Var')[0];
    const expression = within(all, assignment, 'Expression')[0];
    if (!variable || !expression) {
      diagnostics.push({ from: assignment.from, to: assignment.to, message: 'This SET assignment cannot be converted.' });
      continue;
    }
    changes.push({
      from: assignment.from,
      to: assignment.to,
      insert: `BIND(${source.slice(expression.from, expression.to)} AS ${source.slice(variable.from, variable.to)}) FILTER(BOUND(${source.slice(variable.from, variable.to)}))`,
    });
  }
  for (const negation of within(all, body, 'Negation')) {
    const nested = within(all, negation, 'BodyPattern')[0];
    if (!nested) {
      diagnostics.push({ from: negation.from, to: negation.to, message: 'This NOT pattern cannot be converted.' });
      continue;
    }
    changes.push({ from: negation.from, to: negation.to, insert: `FILTER NOT EXISTS ${source.slice(nested.from, nested.to)}` });
  }
  if (diagnostics.length) return { diagnostics };

  const prologue = source.slice(0, rule.from);
  const ruleIriComment = ruleName ? `# SRL rule IRI: ${expandRuleIri(source, ruleName)}\n` : '';
  const text = `${prologue}${ruleIriComment}${form === 'construct' ? 'CONSTRUCT' : 'INSERT'} ${source.slice(heads[0].from, heads[0].to)} WHERE ${replace(source.slice(body.from, body.to), changes.map((change) => ({ ...change, from: change.from - body.from, to: change.to - body.from })))}\n`;
  return checkedSparqlResult(text, rule);
}

/**
 * Raise one simple SPARQL CONSTRUCT query or INSERT update to SRL.
 *
 * `BIND(expr AS ?x)` is represented as `SET ( ?x := expr )`; its immediately
 * following `FILTER(BOUND(?x))`, when present, is removed as redundant.
 */
export function sparqlToSrl(source: string): ConversionResult {
  const tree = sparqlParser.configure({ top: 'SparqlUnit' }).parse(source);
  const diagnostics = errors(tree);
  if (diagnostics.length) return { diagnostics };

  const all = spans(tree);
  const constructs = all.filter((node) => node.name === 'ConstructQuery');
  const inserts = all.filter((node) => node.name === 'InsertData');
  const modifies = all.filter((node) => node.name === 'Modify');
  if (constructs.length + inserts.length + modifies.length !== 1)
    diagnostics.push({ from: 0, to: source.length, message: 'Convert exactly one SPARQL CONSTRUCT or INSERT operation to SRL.' });
  if (diagnostics.length) return { diagnostics };

  if (inserts.length === 1) {
    const insert = inserts[0];
    diagnostics.push(...unsupported(all, insert, ['QuadsNotTriples']));
    const data = within(all, insert, 'QuadData')[0];
    if (!data) diagnostics.push({ from: insert.from, to: insert.to, message: 'This INSERT DATA operation cannot be converted.' });
    if (diagnostics.length) return { diagnostics };
    return checkedSrlResult(`${source.slice(0, insert.from)}DATA ${source.slice(data!.from, data!.to)}\n`, insert);
  }

  const operation = constructs[0] ?? modifies[0];
  const isInsert = modifies.length === 1;
  diagnostics.push(...unsupported(all, operation, [
    'DatasetClause', 'GroupOrUnionGraphPattern', 'OptionalGraphPattern',
    'MinusGraphPattern', 'GraphGraphPattern', 'ServiceGraphPattern', 'InlineData',
    'SubSelect', 'SolutionModifier', 'DeleteClause', 'UsingClause', 'QuadsNotTriples',
  ]));
  const templates = within(all, operation, isInsert ? 'QuadPattern' : 'ConstructTemplate');
  const groups = within(all, operation, 'GroupGraphPattern');
  const body = groups.reduce<Span | undefined>((outer, candidate) => !outer || candidate.to - candidate.from > outer.to - outer.from ? candidate : outer, undefined);
  if (templates.length !== 1 || !body) {
    diagnostics.push({ from: operation.from, to: operation.to, message: 'This operation does not have one convertible template and WHERE block.' });
    return { diagnostics };
  }
  if (diagnostics.length) return { diagnostics };

  const changes: { from: number; to: number; insert: string }[] = [];
  const filters = within(all, body, 'Filter');
  for (const filter of filters) {
    const notExists = within(all, filter, 'NotExistsFunc')[0];
    if (!notExists) continue;
    const pattern = within(all, notExists, 'GroupGraphPattern')[0];
    if (!pattern) {
      diagnostics.push({ from: filter.from, to: filter.to, message: 'This FILTER NOT EXISTS cannot be converted.' });
      continue;
    }
    changes.push({ from: filter.from, to: filter.to, insert: `NOT ${source.slice(pattern.from, pattern.to)}` });
  }
  for (const bind of within(all, body, 'Bind')) {
    const variables = within(all, bind, 'Var');
    const variable = variables[variables.length - 1];
    const expression = within(all, bind, 'Expression')[0];
    if (!variable || !expression) {
      diagnostics.push({ from: bind.from, to: bind.to, message: 'This BIND cannot be converted.' });
      continue;
    }
    const variableText = source.slice(variable.from, variable.to);
    changes.push({ from: bind.from, to: bind.to, insert: `SET ( ${variableText} := ${source.slice(expression.from, expression.to)} )` });
    const boundFilter = filters.find((filter) => {
      const bound = source.slice(filter.from, filter.to).match(/^FILTER\s*\(\s*BOUND\s*\(\s*([?$][\w\d\u00b7\u0300-\u036f\u203f-\u2040]+)\s*\)\s*\)$/i);
      return filter.from >= bind.to && bound?.[1] === variableText;
    });
    if (boundFilter) changes.push({ ...removalSpan(source, boundFilter.from, boundFilter.to), insert: '' });
  }
  if (diagnostics.length) return { diagnostics };

  const prologue = source.slice(0, operation.from);
  const text = `${prologue}RULE ${source.slice(templates[0].from, templates[0].to)} WHERE ${replace(source.slice(body.from, body.to), changes.map((change) => ({ ...change, from: change.from - body.from, to: change.to - body.from })))}\n`;
  return checkedSrlResult(text, operation);
}
