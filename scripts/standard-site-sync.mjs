#!/usr/bin/env node
/**
 * Publishes skiddle.id on AT Protocol with the Standard.site lexicons: keeps one
 * `site.standard.publication` record for the site and one `site.standard.document` per published
 * post in the account's repo, so readers such as Leaflet, pckt and docs.surf can find the posts.
 * Record keys and the publication's at:// URI live in src/lib/standard-site.mjs.
 *
 * Run by .github/workflows/standard-site.yml after the Bluesky announcement (so a new post's
 * announcement can be linked as `bskyPostRef`), or by hand. Each run:
 *   1. waits until skiddle.id serves /.well-known/site.standard.publication with the right URI
 *   2. creates or updates the publication record (name, description, colours, icon)
 *   3. creates or updates a document for every published post that changed, after its page is live
 *      (title, path, description, dates, tags, plain text, share card, Bluesky announcement)
 *   4. deletes skiddle.id documents whose post is gone (drafted again or removed)
 * It never touches records of other publications (pckt.blog, Leaflet), unless MOVE_PCKT_DOCUMENTS
 * is on for the posts pckt published.
 *
 * Environment:
 *   BLUESKY_APP_PASSWORD  app password for the account (not needed for a dry run)
 *   BLUESKY_IDENTIFIER    handle or DID, default skiddle.blue
 *   DRY_RUN=1             show what would change; write nothing (no password needed)
 *   SKIP_WAIT=1           don't wait for the site (testing before the site is deployed)
 * No dependencies: Node 20+ (fetch, Intl.Segmenter).
 */
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { frontmatter } from './bluesky-announce.mjs';
import { plainText } from '../src/lib/plain-text.mjs';
import {
  DID,
  SITE_URL,
  PUBLICATION_NAME,
  PUBLICATION_DESCRIPTION,
  PUBLICATION_RKEY,
  PUBLICATION_URI,
  MOVE_PCKT_DOCUMENTS,
  basicTheme,
  documentRkey,
} from '../src/lib/standard-site.mjs';

const POSTS_DIR = 'src/content/posts';
const ICON_FILE = 'public/android-chrome-512x512.png';
const PUB = 'site.standard.publication';
const DOC = 'site.standard.document';
const LIVE_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_BLOB_BYTES = 1_000_000;

const env = process.env;
const truthy = (v) => /^(1|true|yes)$/i.test(v ?? '');
const dryRun = truthy(env.DRY_RUN);
const identifier = env.BLUESKY_IDENTIFIER || 'skiddle.blue';
const summary = [];
const log = (msg) => {
  console.log(msg);
  summary.push(msg);
};

async function main() {
  const pds = await pdsFor(DID);
  let session; // logged in on the first write
  const write = async () => (session ??= await createSession(pds));
  const counts = { created: 0, updated: 0, unchanged: 0, deleted: 0, skipped: 0 };

  log(`${dryRun ? 'DRY RUN: nothing is written.\n' : ''}Publication: ${PUBLICATION_URI}`);
  if (!truthy(env.SKIP_WAIT)) {
    await waitFor(`${SITE_URL}/.well-known/site.standard.publication`, (body) => body.trim() === PUBLICATION_URI);
  }

  // 1. The publication
  const pub = { $type: PUB, url: SITE_URL, name: truncate(PUBLICATION_NAME, 128), description: truncate(PUBLICATION_DESCRIPTION, 300), basicTheme: basicTheme(), preferences: { showInDiscover: true } };
  const oldPub = await getRecord(pds, PUB, PUBLICATION_RKEY);
  if (oldPub && same(oldPub, pub, ['url', 'name', 'description', 'basicTheme', 'preferences']) && oldPub.icon) {
    counts.unchanged++;
    log(`publication: unchanged`);
  } else {
    pub.icon = oldPub?.icon ?? (dryRun ? '(icon: ' + ICON_FILE + ')' : await uploadBlob(await write(), readFileSync(ICON_FILE), 'image/png'));
    if (dryRun) log(`publication: would ${oldPub ? 'update' : 'create'}\n${JSON.stringify(pub, null, 2)}`);
    else {
      await putRecord(await write(), PUB, PUBLICATION_RKEY, pub);
      log(`publication: ${oldPub ? 'updated' : 'created'}`);
    }
    counts[oldPub ? 'updated' : 'created']++;
  }

  // 2. A document per published post
  const posts = readPosts();
  const keep = new Set();
  let shownExample = false;
  for (const post of posts) {
    const rkey = documentRkey(post);
    if (!rkey) {
      counts.skipped++;
      log(`skip ${post.slug}: published by pckt.blog (rkey ${post.rkey}); MOVE_PCKT_DOCUMENTS is off`);
      continue;
    }
    keep.add(rkey);
    const old = await getRecord(pds, DOC, rkey);
    if (old && old.site !== PUBLICATION_URI && !(MOVE_PCKT_DOCUMENTS && post.rkey === rkey)) {
      counts.skipped++;
      log(`skip ${post.slug}: ${rkey} belongs to another publication (${old.site})`);
      continue;
    }

    const doc = await documentFor(post, pds);
    const fields = ['site', 'path', 'title', 'description', 'publishedAt', 'updatedAt', 'tags', 'textContent', 'bskyPostRef'];
    if (old && same(old, doc, fields) && old.coverImage) {
      counts.unchanged++;
      continue;
    }

    const moving = old && old.site !== PUBLICATION_URI;
    // Reuse the uploaded share card unless something on it changed
    const cardSame = old && !moving && old.coverImage && same(old, doc, ['title', 'description', 'publishedAt']);
    const verb = !old ? 'create' : moving ? 'move to skiddle.id' : 'update';
    if (dryRun) {
      if (!shownExample) {
        shownExample = true;
        log(`\nexample record (${post.slug}):\n${JSON.stringify({ ...doc, coverImage: cardSame ? '(kept)' : '(share card)', textContent: `${doc.textContent.slice(0, 160)}… (${doc.textContent.length} chars)` }, null, 2)}\n`);
      }
      log(`${post.slug}: would ${verb} ${rkey}${old && !moving ? ` (changed: ${changed(old, doc, fields).join(', ')})` : ''}`);
    } else {
      if (!truthy(env.SKIP_WAIT)) await waitFor(`${SITE_URL}${doc.path}`, (html) => html.includes(`at://${DID}/${DOC}/${rkey}`));
      const s = await write();
      const card = cardSame ? old.coverImage : await shareCard(s, post);
      if (card) doc.coverImage = card;
      // Keep fields other tools may have added to our own records; a moved pckt record starts clean
      await putRecord(s, DOC, rkey, moving || !old ? doc : { ...old, ...doc });
      log(`${post.slug}: ${verb === 'create' ? 'created' : verb === 'update' ? 'updated' : 'moved to skiddle.id'} ${rkey}`);
    }
    counts[!old ? 'created' : 'updated']++;
  }

  // 3. Documents of this publication whose post is gone
  for (const rec of await listRecords(pds, DOC)) {
    const rkey = rec.uri.split('/').pop();
    if (rec.value?.site !== PUBLICATION_URI || keep.has(rkey)) continue;
    counts.deleted++;
    if (dryRun) log(`would delete ${rkey} ("${rec.value.title}"): no published post uses it`);
    else {
      await xrpc(pds, 'com.atproto.repo.deleteRecord', { jwt: (await write()).jwt, body: { repo: DID, collection: DOC, rkey } });
      log(`deleted ${rkey} ("${rec.value.title}"): no published post uses it`);
    }
  }

  const c = counts;
  log(`\n${dryRun ? 'Would create' : 'Created'} ${c.created}, ${dryRun ? 'update' : 'updated'} ${c.updated}, ${dryRun ? 'delete' : 'deleted'} ${c.deleted}; ${c.unchanged} unchanged, ${c.skipped} skipped.`);
}

/** Published posts from the content folder */
function readPosts() {
  const out = [];
  for (const name of readdirSync(POSTS_DIR).sort()) {
    if (!/\.mdx?$/.test(name)) continue;
    const src = readFileSync(join(POSTS_DIR, name), 'utf8');
    const fm = frontmatter(src);
    const pubDate = new Date(fm.pubDate);
    if (fm.draft === true || !fm.title || Number.isNaN(pubDate.valueOf())) continue;
    out.push({
      slug: name.replace(/\.mdx?$/, ''),
      title: fm.title,
      description: fm.description ?? '',
      pubDate,
      updatedDate: fm.updatedDate ? new Date(fm.updatedDate) : undefined,
      tags: list(fm.tags),
      rkey: fm.rkey || undefined,
      bluesky: fm.bluesky || undefined,
      body: src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''),
    });
  }
  return out;
}

/** `[a, b, "c"]` → ['a', 'b', 'c'] */
const list = (v) =>
  typeof v === 'string' ? v.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : [];

async function documentFor(post, pds) {
  const doc = {
    $type: DOC,
    site: PUBLICATION_URI,
    path: `/posts/${post.slug}/`,
    title: truncate(post.title, 500),
    publishedAt: post.pubDate.toISOString(),
    textContent: plainText(post.body),
  };
  if (post.description) doc.description = truncate(post.description, 300);
  if (post.updatedDate && !Number.isNaN(post.updatedDate.valueOf())) doc.updatedAt = post.updatedDate.toISOString();
  // Leaflet drops records with tags over 50 graphemes / 100 characters
  const tags = post.tags.map((t) => t.replace(/^#/, '')).filter((t) => t && graphemes(t) <= 50 && t.length <= 100);
  if (tags.length) doc.tags = tags;
  if (post.bluesky) {
    const ref = await strongRef(pds, post.bluesky);
    if (ref) doc.bskyPostRef = ref;
  }
  return doc;
}

/** { uri, cid } of the Bluesky post announcing the post */
async function strongRef(pds, uri) {
  const [, repo, collection, rkey] = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri) ?? [];
  if (!repo) return undefined;
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?repo=${repo}&collection=${collection}&rkey=${rkey}`);
  if (!res.ok) return undefined;
  const { cid } = await res.json();
  return cid ? { uri, cid } : undefined;
}

/** The post's share card from the live site, uploaded as a blob */
async function shareCard(session, post) {
  try {
    const res = await fetch(`${SITE_URL}/og/posts/${post.slug}.png`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!res.ok || bytes.length > MAX_BLOB_BYTES) return undefined;
    return await uploadBlob(session, bytes, 'image/png');
  } catch {
    return undefined;
  }
}

const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
const same = (a, b, fields) => fields.every((f) => canon(a[f]) === canon(b[f]));
const changed = (a, b, fields) => fields.filter((f) => canon(a[f]) !== canon(b[f]));

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (s) => [...segmenter.segment(s)].length;
function truncate(s, max) {
  const parts = [...segmenter.segment(s ?? '')].map((x) => x.segment);
  return parts.length <= max ? s ?? '' : `${parts.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

async function waitFor(url, ok) {
  const deadline = Date.now() + LIVE_TIMEOUT_MS;
  for (;;) {
    const res = await fetch(`${url}?sync=${Date.now()}`).catch(() => null);
    if (res?.ok && ok(await res.text())) return;
    if (Date.now() > deadline) throw new Error(`${url} isn't live (or doesn't show the record yet) after ${LIVE_TIMEOUT_MS / 60000} minutes`);
    console.log(`waiting for ${url} (${res ? res.status : 'no response'})…`);
    await new Promise((r) => setTimeout(r, 15_000));
  }
}

async function pdsFor(did) {
  const doc = await (await fetch(`https://plc.directory/${did}`)).json();
  const pds = doc.service?.find((s) => s.id === '#atproto_pds' || s.id === `${did}#atproto_pds`)?.serviceEndpoint;
  if (!pds) throw new Error(`No PDS in the DID document for ${did}`);
  return pds.replace(/\/$/, '');
}

async function getRecord(pds, collection, rkey) {
  const res = await fetch(`${pds}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${collection}&rkey=${rkey}`);
  if (res.status === 400 || res.status === 404) return undefined; // RecordNotFound
  if (!res.ok) throw new Error(`getRecord ${collection}/${rkey} failed (${res.status})`);
  return (await res.json()).value;
}

async function listRecords(pds, collection) {
  const out = [];
  let cursor = '';
  do {
    const res = await fetch(`${pds}/xrpc/com.atproto.repo.listRecords?repo=${DID}&collection=${collection}&limit=100${cursor ? `&cursor=${cursor}` : ''}`);
    if (!res.ok) throw new Error(`listRecords ${collection} failed (${res.status})`);
    const data = await res.json();
    out.push(...(data.records ?? []));
    cursor = data.cursor ?? '';
  } while (cursor);
  return out;
}

async function xrpc(pds, method, { jwt, body, contentType = 'application/json' } = {}) {
  const res = await fetch(`${pds}/xrpc/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
    body: contentType === 'application/json' ? JSON.stringify(body) : body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} failed (${res.status}): ${data.error ?? ''} ${data.message ?? ''}`.trim());
  return data;
}

async function createSession(pds) {
  const password = env.BLUESKY_APP_PASSWORD;
  if (!password) throw new Error('BLUESKY_APP_PASSWORD is not set (add it as a repository secret)');
  const { accessJwt, did } = await xrpc(pds, 'com.atproto.server.createSession', { body: { identifier, password } });
  if (did !== DID) throw new Error(`Logged in as ${did}, expected ${DID}`);
  return { pds, jwt: accessJwt };
}

async function uploadBlob(session, bytes, type) {
  return (await xrpc(session.pds, 'com.atproto.repo.uploadBlob', { jwt: session.jwt, body: bytes, contentType: type })).blob;
}

async function putRecord(session, collection, rkey, record) {
  await xrpc(session.pds, 'com.atproto.repo.putRecord', { jwt: session.jwt, body: { repo: DID, collection, rkey, record } });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((err) => {
      console.error(`::error::${err.message}`);
      summary.push(`**Failed:** ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => {
      if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `## Standard.site sync\n\`\`\`\n${summary.join('\n')}\n\`\`\`\n`);
    });
}
