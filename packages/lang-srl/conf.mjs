import { parser } from './dist/index.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = 'test/corpus/srl-syntax';
const idx = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
const fails = [];
for (const e of idx) {
  const text = readFileSync(join(dir, e.file), 'utf8');
  let n = 0;
  parser.parse(text).iterate({ enter: (x) => { if (x.type.isError) n++; } });
  const agree = e.expect === 'positive' ? n === 0 : n > 0;
  if (!agree) fails.push(`${e.name} [${e.expect}] ${e.file}`);
}
console.log(`${idx.length - fails.length}/${idx.length}`);
fails.forEach((f) => console.log('  ' + f));
