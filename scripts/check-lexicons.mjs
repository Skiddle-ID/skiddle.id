#!/usr/bin/env node
/**
 * Checks the lexicons in lexicons/: each is a valid lexicon document, and its path matches its id
 * (lexicons/id/skiddle/post.json is id.skiddle.post). Runs in CI: `npm run check:lexicons`.
 *
 * Before the v4 launch this also checked every post, series and page of the site's data against
 * the lexicons, on their way into records. Since the launch the records are the only copy, and the
 * admin app checks each record against its lexicon before it saves it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Lexicons } from '@atproto/lexicon';

const ROOT = join(import.meta.dirname, '..');
const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.json')) files.push(path);
  }
};
walk(join(ROOT, 'lexicons'));

const lex = new Lexicons();
const ids = [];
for (const file of files.sort()) {
  const where = relative(ROOT, file);
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    fail(where, `isn't JSON: ${err.message}`);
    continue;
  }
  const expected = relative(join(ROOT, 'lexicons'), file).replace(/\.json$/, '').split(/[\\/]/).join('.');
  if (doc.id !== expected) fail(where, `its id is "${doc.id}"; at this path it should be "${expected}"`);
  try {
    lex.add(doc);
    ids.push(doc.id);
  } catch (err) {
    fail(where, err.message);
  }
}

if (errors.length) {
  console.error(`${errors.length} problem${errors.length > 1 ? 's' : ''}:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`All ${ids.length} lexicons are valid: ${ids.join(', ')}.`);
