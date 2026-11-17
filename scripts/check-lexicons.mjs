#!/usr/bin/env node
/**
 * Checks the lexicons in lexicons/ and that every post and series fits them, as the AT Protocol
 * sync will write them (docs/v4/posts-on-atproto.md). Runs in CI: `npm run check:lexicons`.
 *
 *   - every lexicons/**\/*.json is a valid lexicon document
 *   - every post's id.skiddle.post content validates (a draft post: as an id.skiddle.draft record)
 *   - every series' id.skiddle.series record validates, and its key is a valid record key
 *   - a draft made from the newest post validates
 *   - the Markdown has no MDX (imports, exports, components), which a record can't hold
 *   - images: the file exists, is a PNG, JPEG, GIF or WebP under 1 MB, has alt text and a size
 *
 * Images aren't uploaded: each gets a blob reference with the CID the PDS would give it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { frontmatter } from './bluesky-announce.mjs';
import { blobRef, imageType } from './lib/blob.mjs';
import { DRAFT_COLLECTION, POST_TYPE, SERIES_COLLECTION, imageSize, localImages, postContent, seriesRecords } from '../src/lib/post-record.mjs';

const ROOT = join(import.meta.dirname, '..');
const POSTS_DIR = join(ROOT, 'src/content/posts');
const MAX_IMAGE = 1_000_000;

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

// The lexicons
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.json')) files.push(path);
  }
};
walk(join(ROOT, 'lexicons'));
const docs = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
const lex = new Lexicons();
for (const [i, doc] of docs.entries()) {
  try {
    lex.add(doc);
  } catch (err) {
    fail(relative(ROOT, files[i]), err.message);
  }
}
console.log(`lexicons: ${docs.map((d) => d.id).join(', ')}`);

const validate = (where, check) => {
  try {
    const result = check();
    if (result && result.success === false) fail(where, result.error.message);
  } catch (err) {
    fail(where, err.message);
  }
};

/** Lines outside fenced code blocks */
const proseLines = (markdown) => markdown.replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, '').split('\n');

// The posts
const posts = [];
for (const file of readdirSync(POSTS_DIR).sort()) {
  if (!/\.mdx?$/.test(file)) continue;
  const where = `src/content/posts/${file}`;
  const src = readFileSync(join(POSTS_DIR, file), 'utf8');
  const fm = frontmatter(src);
  const body = src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const pubDate = new Date(fm.pubDate);
  posts.push({ slug: file.replace(/\.mdx?$/, ''), fm, pubDate, series: fm.series || undefined });

  if (file.endsWith('.mdx')) fail(where, 'is MDX; posts must be Markdown (.md) to become records');
  for (const line of proseLines(body)) {
    if (/^(import|export)\s/.test(line)) fail(where, `has an MDX ${line.split(/\s/)[0]}: ${line.trim()}`);
    else if (/<[A-Z][A-Za-z0-9]*[\s/>]/.test(line.replace(/`[^`]*`/g, ''))) fail(where, `has an MDX component: ${line.trim()}`);
  }

  const { markdown, images: found } = localImages(body);
  const images = [];
  for (const image of found) {
    const at = `${where}, image ${image.path}`;
    const type = imageType(image.path);
    let bytes;
    try {
      bytes = readFileSync(join(dirname(join(POSTS_DIR, file)), image.path));
    } catch {
      fail(at, 'file not found');
      continue;
    }
    if (!type) fail(at, 'is not a PNG, JPEG, GIF or WebP');
    if (bytes.length > MAX_IMAGE) fail(at, `is ${bytes.length} bytes; the limit is ${MAX_IMAGE}, so shrink it`);
    if (!image.alt.trim()) fail(at, 'has no alt text');
    const size = imageSize(bytes);
    if (!size) fail(at, "size can't be read from the file");
    images.push({
      name: image.name,
      image: blobRef(bytes, type ?? 'application/octet-stream'),
      alt: image.alt,
      ...(image.title ? { caption: image.title } : {}),
      ...(size ?? {}),
    });
  }

  let content;
  try {
    content = postContent(fm, markdown, images);
  } catch (err) {
    fail(where, err.message);
    continue;
  }
  if (fm.draft === true) {
    const draft = { $type: DRAFT_COLLECTION, title: fm.title, content, createdAt: new Date().toISOString() };
    validate(where, () => lex.assertValidRecord(DRAFT_COLLECTION, jsonToLex(draft)));
  } else {
    validate(where, () => lex.validate(POST_TYPE, jsonToLex(content)));
  }
  const extra = [images.length && `${images.length} image${images.length > 1 ? 's' : ''}`, content.series && `part ${content.series.part}`, content.lang && `lang ${content.lang}`]
    .filter(Boolean)
    .join(', ');
  console.log(`  ${fm.draft === true ? 'draft' : 'post '} ${file} (${markdown.length} chars${extra ? `, ${extra}` : ''})`);
}

// A draft made from the newest post, with everything a draft can have
const newest = posts.filter((p) => p.fm.draft !== true).sort((a, b) => b.pubDate - a.pubDate)[0];
if (newest) {
  const body = readFileSync(join(POSTS_DIR, `${newest.slug}.md`), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const draft = {
    $type: DRAFT_COLLECTION,
    title: newest.fm.title,
    description: newest.fm.description,
    path: `/posts/${newest.slug}/`,
    tags: ['example'],
    content: postContent(newest.fm, localImages(body).markdown),
    publishAt: new Date(Date.now() + 86_400_000).toISOString(),
    createdAt: new Date().toISOString(),
  };
  validate(`a draft from ${newest.slug}`, () => lex.assertValidRecord(DRAFT_COLLECTION, jsonToLex(draft)));
}

// The series
const { seriesInfo } = await import('../src/data/series.ts');
const series = seriesRecords(posts.filter((p) => p.fm.draft !== true), seriesInfo);
for (const [rkey, record] of series) {
  const where = `series "${record.name}"`;
  if (!/^[A-Za-z0-9._:~-]{1,512}$/.test(rkey) || rkey === '.' || rkey === '..') fail(where, `"${rkey}" isn't a valid record key`);
  validate(where, () => lex.assertValidRecord(SERIES_COLLECTION, jsonToLex(record)));
  const parts = posts.filter((p) => p.series === record.name && p.fm.draft !== true).length;
  console.log(`  series ${rkey} (${parts} published${record.planned ? `, ${record.planned.length} planned` : ''}${record.ongoing ? ', ongoing' : ''})`);
}

if (errors.length) {
  console.error(`\n${errors.length} problem${errors.length > 1 ? 's' : ''}:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`\nAll ${posts.length} posts and ${series.size} series fit the lexicons.`);
