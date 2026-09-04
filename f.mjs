import { EditorState } from '@codemirror/state';
import { foldable, indentUnit } from '@codemirror/language';
import { sparql } from './dist/index.js';
const docs = [
  ['ASK {\n  FILTER(ex:f(\n    ?a,\n    ?b\n  ))\n}\n', 'FILTER'],
  ['ASK {\n  VALUES ?x {\n    1\n    2\n  }\n}\n', 'VALUES'],
  ['ASK {\n  ?s ex:p ?o {|\n    ex:q ?z\n  |}\n}\n', '{|'],
];
for (const [doc, find] of docs) {
  const st = EditorState.create({ doc, extensions: [sparql(), indentUnit.of('  ')] });
  const at = doc.indexOf(find);
  const line = st.doc.lineAt(at);
  const r = foldable(st, line.from, line.to);
  console.log(JSON.stringify(find), '->', r ? JSON.stringify(st.doc.sliceString(r.from, r.to)) : null);
}
