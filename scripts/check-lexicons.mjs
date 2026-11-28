#!/usr/bin/env node
/**
 * Checks the lexicons in lexicons/: each is a valid lexicon document, and its path matches its id
 * (lexicons/id/skiddle/post.json is id.skiddle.post). Runs in CI: `npm run check:lexicons`.
 *
 * It also checks the records the site and the admin app make themselves: the built-in
 * id.skiddle.page records of home, Now, Services and Notes (src/lib/page-legacy.mjs), which a page
 * renders while it has no page record and the block editor starts from. Before the v4 launch it
 * checked every post, series and page of the site's data on their way into records; since then the
 * admin app checks each record it saves.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { FALLBACK_HOME } from '../src/data/home.ts';
import { PAGE_COLLECTION } from '../src/lib/page-blocks.mjs';
import { CONTENT_PAGES } from '../src/data/list-pages.ts';
import { homePageFromLegacy, notesPageFromLegacy, nowPageFromLegacy, servicesPageFromLegacy } from '../src/lib/page-legacy.mjs';

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

// Records made from data, each checked against its lexicon
const at = new Date().toISOString();
const made = [
  ['the home page', PAGE_COLLECTION, homePageFromLegacy(FALLBACK_HOME, at)],
  ['the Now page', PAGE_COLLECTION, nowPageFromLegacy(CONTENT_PAGES.now, at)],
  ['the Services page', PAGE_COLLECTION, servicesPageFromLegacy(CONTENT_PAGES.services, at)],
  ['the Notes page', PAGE_COLLECTION, notesPageFromLegacy(CONTENT_PAGES.notes, at)],
];
for (const [what, collection, record] of made) {
  try {
    lex.assertValidRecord(collection, jsonToLex(record));
  } catch (err) {
    fail(what, err.message);
  }
}

if (errors.length) {
  console.error(`${errors.length} problem${errors.length > 1 ? 's' : ''}:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`All ${ids.length} lexicons are valid: ${ids.join(', ')}. ${made.length} built-in records match theirs.`);
