#!/usr/bin/env node
/**
 * Marks revised posts as updated. For each post changed in a push to v3 that was already published
 * before the push: if its text, title or description changed, and the push didn't set
 * `updatedDate` itself, sets `updatedDate` to now. The post page then shows both dates, and the
 * sitemap, the JSON-LD and the AT Protocol record get the new date.
 *
 * Not "updated": posts published in this push (a draft going public, a scheduled post going live)
 * and changes to other frontmatter (tags, series, the Bluesky link…). For a change that shouldn't
 * count, like a typo fix, put "[skip updated]" in the PR title or a commit message.
 *
 * Run by .github/workflows/bluesky-announce.yml before the announcement.
 *
 * Environment:
 *   BEFORE, AFTER  git range of the push (defaults: AFTER~1, HEAD)
 *   DRY_RUN=1      show what would change; change nothing
 *   NOW=<date>     use this time instead of now (testing)
 * No dependencies.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { frontmatter } from './bluesky-announce.mjs';

const POSTS_DIR = 'src/content/posts';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const after = process.env.AFTER || 'HEAD';
let before = process.env.BEFORE;
if (!before || /^0+$/.test(before)) before = `${after}~1`;
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const dryRun = /^(1|true|yes)$/i.test(process.env.DRY_RUN ?? '');

if (/\[skip updated\]/i.test(git('log', '--format=%B', `${before}..${after}`))) {
  console.log('A commit in this push says [skip updated]: leaving the dates alone.');
  process.exit(0);
}

const files = git('diff', '--name-only', '--diff-filter=M', before, after, '--', POSTS_DIR)
  .split('\n')
  .filter((f) => /\.mdx?$/.test(f));
const body = (src) => src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();

let marked = 0;
for (const file of files) {
  if (!existsSync(file)) continue;
  const old = git('show', `${before}:${file}`);
  const cur = readFileSync(file, 'utf8');
  const o = frontmatter(old);
  const n = frontmatter(cur);
  const skip = (why) => console.log(`skip ${file}: ${why}`);
  if (o.draft === true) { skip('published in this push, not updated'); continue; }
  if (n.draft === true) { skip('a draft again'); continue; }
  if (o.updatedDate !== n.updatedDate) { skip('updatedDate set in this push'); continue; }
  if (body(old) === body(cur) && o.title === n.title && o.description === n.description) {
    skip('only other frontmatter changed');
    continue;
  }
  console.log(`${dryRun ? 'DRY RUN: would mark' : 'mark'} ${file} as updated ${now.toISOString()}`);
  if (!dryRun) writeFileSync(file, setUpdated(cur, now));
  marked++;
}
if (!marked) console.log('No revised posts to mark as updated.');

/** Sets `updatedDate:` (replacing it, or right after `pubDate:`) */
function setUpdated(src, date) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  if (!m) throw new Error('Post has no frontmatter');
  const lines = m[1].split(/\r?\n/);
  const value = `updatedDate: ${date.toISOString()}`;
  const i = lines.findIndex((l) => /^updatedDate:/.test(l));
  if (i >= 0) lines[i] = value;
  else lines.splice(lines.findIndex((l) => /^pubDate:/.test(l)) + 1, 0, value);
  return src.replace(m[0], `---\n${lines.join('\n')}\n---`);
}
