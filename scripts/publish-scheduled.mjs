#!/usr/bin/env node
/**
 * Publishes scheduled posts. Every post with `draft: true` and a `publishAt` time that has passed
 * becomes `draft: false`, gets `pubDate: <publishAt>`, and loses its `publishAt` line (and the
 * drafts' "Set pubDate…" comment). Oldest first, so announcements stay in order.
 *
 * Run every hour by .github/workflows/scheduled-publish.yml, which then commits the change to v3
 * (Cloudflare deploys it) and starts the Bluesky announcement for these posts.
 *
 * Environment:
 *   DRY_RUN=1      show what would be published; change nothing
 *   NOW=<date>     pretend it's this time (testing)
 *   GITHUB_OUTPUT  gets `slugs=a,b` and `titles="A", "B"` for the workflow
 * No dependencies.
 */
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { frontmatter } from './bluesky-announce.mjs';

const POSTS_DIR = 'src/content/posts';
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const dryRun = /^(1|true|yes)$/i.test(process.env.DRY_RUN ?? '');

const due = [];
for (const name of readdirSync(POSTS_DIR).sort()) {
  if (!/\.mdx?$/.test(name)) continue;
  const file = join(POSTS_DIR, name);
  const src = readFileSync(file, 'utf8');
  const fm = frontmatter(src);
  if (fm.draft !== true || !fm.publishAt) continue;
  const at = new Date(fm.publishAt);
  if (Number.isNaN(at.valueOf())) {
    console.log(`skip ${name}: publishAt "${fm.publishAt}" isn't a date`);
    continue;
  }
  if (at > now) {
    console.log(`not yet: ${name} (${at.toISOString()})`);
    continue;
  }
  due.push({ file, src, slug: name.replace(/\.mdx?$/, ''), title: fm.title || name, at });
}
due.sort((a, b) => a.at - b.at);

if (!due.length) console.log('Nothing scheduled is due.');
for (const post of due) {
  console.log(`${dryRun ? 'DRY RUN: would publish' : 'publish'} ${post.slug} ("${post.title}"), scheduled for ${post.at.toISOString()}`);
  if (!dryRun) writeFileSync(post.file, publish(post.src, post.at));
}

if (process.env.GITHUB_OUTPUT && !dryRun && due.length) {
  const titles = due.map((p) => `"${p.title.replace(/["\n]/g, '')}"`).join(', ');
  appendFileSync(process.env.GITHUB_OUTPUT, `slugs=${due.map((p) => p.slug).join(',')}\ntitles=${titles}\n`);
}

/** The post with draft: false, pubDate set to the scheduled time and publishAt removed */
function publish(src, at) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  if (!m) throw new Error('Post has no frontmatter');
  const lines = m[1]
    .split(/\r?\n/)
    .filter((l) => !/^publishAt:/.test(l) && !/^# Set pubDate to the day you publish/.test(l))
    .map((l) => (/^draft:\s*true\s*$/.test(l) ? 'draft: false' : /^pubDate:/.test(l) ? `pubDate: ${at.toISOString()}` : l));
  return src.replace(m[0], `---\n${lines.join('\n')}\n---`);
}
