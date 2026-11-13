#!/usr/bin/env node
/**
 * Announces newly published posts on Bluesky, then links each post to its announcement
 * (`bluesky: at://…` in the frontmatter) so replies show up as comments on the site.
 *
 * Run by .github/workflows/bluesky-announce.yml after a push to v3. For every post changed in
 * the push that is published (draft: false), has no `bluesky:` line and is at most 14 days old:
 *   1. wait until the post is live on skiddle.id
 *   2. reuse an existing Bluesky post that already links to it (manual share or an earlier
 *      run), so a post is never announced twice
 *   3. otherwise post "Title" + link, with the post's share card as a link card
 *   4. add the `bluesky:` line to the post file (the workflow commits it)
 *
 * Environment:
 *   BLUESKY_APP_PASSWORD  app password for the account (not the account password)
 *   BLUESKY_IDENTIFIER    handle or DID, default skiddle.blue
 *   BEFORE, AFTER         git range of the push (defaults: HEAD~1, HEAD)
 *   SLUG                  announce this post instead (manual run; no age limit)
 *   DRY_RUN=1             show what would happen; no post or file change (logs in to
 *                         check the app password if it's set)
 *   SKIP_WAIT=1           don't wait for the post to be live (testing)
 * No dependencies: Node 20+ (fetch, Intl.Segmenter).
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://skiddle.id';
const POSTS_DIR = 'src/content/posts';
const PUBLIC_API = 'https://public.api.bsky.app/xrpc';
const MAX_AGE_DAYS = 14;
const LIVE_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_THUMB_BYTES = 1_000_000;

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
  const did = await resolveDid(identifier);
  let session; // created on first use

  // A dry run with the password available checks the login too (logging in posts nothing)
  if (dryRun && env.BLUESKY_APP_PASSWORD) {
    session = await createSession(did);
    log(`Login OK: ${identifier} (${did}) on ${session.pds}`);
  }

  const posts = candidatePosts();
  if (!posts.length) {
    log('No new published posts without a Bluesky link. Nothing to do.');
    return;
  }

  for (const post of posts) {
    const url = `${SITE}/posts/${post.slug}/`;
    log(`\n### ${post.title}\n${url}`);

    let uri = await findExistingAnnouncement(did, url);
    if (uri) {
      log(`Already on Bluesky, reusing: ${bskyUrl(uri)}`);
    } else {
      if (!truthy(env.SKIP_WAIT)) await waitForLive(url);
      const record = await buildRecord(post, url);
      if (dryRun) {
        log(`DRY RUN: would post:\n${JSON.stringify({ ...record, embed: { ...record.embed, external: { ...record.embed.external, thumb: record.embed.external.thumb ? '(image)' : undefined } } }, null, 2)}`);
        continue;
      }
      session ??= await createSession(did);
      if (record.embed.external.thumb) {
        record.embed.external.thumb = await uploadBlob(session, record.embed.external.thumb);
      }
      uri = await createPost(session, record);
      log(`Posted: ${bskyUrl(uri)}`);
    }

    if (dryRun) {
      log(`DRY RUN: would add \`bluesky: ${uri}\` to ${post.file}`);
    } else {
      writeFileSync(post.file, addBlueskyLine(readFileSync(post.file, 'utf8'), uri));
      log(`Linked ${post.file} to the thread (comments on).`);
    }
  }
}

/** Published posts from this push (or SLUG) that still need an announcement */
function candidatePosts() {
  const files = env.SLUG ? [postFile(env.SLUG.trim())] : changedPostFiles();
  const now = Date.now();
  const out = [];
  for (const file of files) {
    if (!existsSync(file)) continue; // deleted or renamed away
    const fm = frontmatter(readFileSync(file, 'utf8'));
    const slug = file.split('/').pop().replace(/\.mdx?$/, '');
    const pubDate = new Date(fm.pubDate);
    const skip = (why) => console.log(`skip ${slug}: ${why}`);
    if (fm.draft === true) { skip('draft'); continue; }
    if (fm.bluesky) { skip('already has a bluesky link'); continue; }
    if (!fm.title) { skip('no title'); continue; }
    if (Number.isNaN(pubDate.valueOf())) { skip('no valid pubDate'); continue; }
    if (!env.SLUG && now - pubDate.valueOf() > MAX_AGE_DAYS * 86_400_000) { skip(`older than ${MAX_AGE_DAYS} days (announce it by hand with SLUG)`); continue; }
    out.push({ file, slug, title: fm.title, description: fm.description ?? '', lang: fm.lang || 'en' });
  }
  return out;
}

function changedPostFiles() {
  const after = env.AFTER || 'HEAD';
  let before = env.BEFORE;
  if (!before || /^0+$/.test(before)) before = `${after}~1`;
  const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=AMR', before, after, '--', POSTS_DIR], { encoding: 'utf8' });
  return out.split('\n').filter((f) => /\.mdx?$/.test(f));
}

function postFile(slug) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) throw new Error(`Invalid slug: ${slug}`);
  for (const ext of ['md', 'mdx']) {
    const file = join(POSTS_DIR, `${slug}.${ext}`);
    if (existsSync(file)) return file;
  }
  throw new Error(`No post called ${slug} in ${POSTS_DIR}`);
}

/** Minimal frontmatter reader for the flat `key: value` lines these posts use */
export function frontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  if (!m) return {};
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let value = kv[2].trim();
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { value = value.replace(/^"|"$/g, ''); }
    } else if (value.startsWith("'")) {
      value = value.replace(/^'|'$/g, '').replace(/''/g, "'");
    } else if (value === 'true' || value === 'false') {
      value = value === 'true';
    }
    data[kv[1]] = value;
  }
  return data;
}

/** Adds `bluesky: <uri>` to the frontmatter (before `draft:`, else at the end) */
export function addBlueskyLine(src, uri) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
  if (!m) throw new Error('Post has no frontmatter');
  const lines = m[1].split(/\r?\n/);
  if (lines.some((l) => /^bluesky:/.test(l))) return src;
  const at = lines.findIndex((l) => /^draft:/.test(l));
  lines.splice(at === -1 ? lines.length : at, 0, `bluesky: ${uri}`);
  return src.replace(m[0], `---\n${lines.join('\n')}\n---`);
}

async function waitForLive(url) {
  const deadline = Date.now() + LIVE_TIMEOUT_MS;
  for (;;) {
    const res = await fetch(`${url}?announce=${Date.now()}`).catch(() => null);
    if (res?.ok) return;
    if (Date.now() > deadline) throw new Error(`${url} is not live after ${LIVE_TIMEOUT_MS / 60000} minutes`);
    console.log(`waiting for ${url} to go live (${res ? res.status : 'no response'})…`);
    await new Promise((r) => setTimeout(r, 15_000));
  }
}

/** The post record: "Title" + link, with the share card as a link card */
export async function buildRecord(post, url, { fetchImpl = fetch } = {}) {
  const display = url.replace(/^https:\/\//, '').replace(/\/$/, '');
  const title = truncate(post.title, 300 - graphemes(display) - 2);
  const text = `${title}\n\n${display}`;
  const enc = new TextEncoder();
  const byteStart = enc.encode(`${title}\n\n`).length;

  let thumb;
  try {
    const page = await (await fetchImpl(url)).text();
    const image = /<meta property="og:image" content="([^"]+)"/.exec(page)?.[1];
    if (image) {
      const res = await fetchImpl(image);
      const type = (res.headers.get('content-type') ?? '').split(';')[0];
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (res.ok && /^image\/(png|jpeg|webp)$/.test(type) && bytes.length <= MAX_THUMB_BYTES) thumb = { bytes, type };
    }
  } catch {
    // post without a card image
  }

  return {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
    langs: [post.lang],
    facets: [{ index: { byteStart, byteEnd: byteStart + enc.encode(display).length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }] }],
    embed: { $type: 'app.bsky.embed.external', external: { uri: url, title: post.title, description: truncate(post.description, 300), thumb } },
  };
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (s) => [...segmenter.segment(s)].length;
function truncate(s, max) {
  const parts = [...segmenter.segment(s ?? '')].map((x) => x.segment);
  return parts.length <= max ? s ?? '' : `${parts.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

/** A recent post by this account that already links to `url`, if any */
async function findExistingAnnouncement(did, url) {
  const norm = (u) => (u ?? '').replace(/[?#].*$/, '').replace(/\/$/, '');
  const target = norm(url);
  const res = await fetch(`${PUBLIC_API}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(did)}&limit=50&filter=posts_no_replies`);
  if (!res.ok) throw new Error(`Couldn't read the Bluesky feed (${res.status})`);
  const { feed = [] } = await res.json();
  for (const { post } of feed) {
    if (post.author?.did !== did) continue; // reposts
    const rec = post.record ?? {};
    const links = [rec.embed?.external?.uri, rec.embed?.media?.external?.uri, ...(rec.facets ?? []).flatMap((f) => f.features?.map((x) => x.uri) ?? [])];
    if (links.some((l) => norm(l) === target)) return post.uri;
  }
  return undefined;
}

async function resolveDid(id) {
  if (id.startsWith('did:')) return id;
  const res = await fetch(`${PUBLIC_API}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Couldn't resolve ${id} (${res.status})`);
  return (await res.json()).did;
}

async function pdsFor(did) {
  const docUrl = did.startsWith('did:web:') ? `https://${did.slice(8)}/.well-known/did.json` : `https://plc.directory/${did}`;
  const doc = await (await fetch(docUrl)).json();
  const pds = doc.service?.find((s) => s.id === '#atproto_pds' || s.id === `${did}#atproto_pds`)?.serviceEndpoint;
  if (!pds) throw new Error(`No PDS in the DID document for ${did}`);
  return pds.replace(/\/$/, '');
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

async function createSession(did) {
  const password = env.BLUESKY_APP_PASSWORD;
  if (!password) throw new Error('BLUESKY_APP_PASSWORD is not set (add it as a repository secret)');
  const pds = await pdsFor(did);
  const { accessJwt, did: sessionDid } = await xrpc(pds, 'com.atproto.server.createSession', { body: { identifier, password } });
  if (sessionDid !== did) throw new Error(`Logged in as ${sessionDid}, expected ${did}`);
  return { pds, jwt: accessJwt, did };
}

async function uploadBlob(session, { bytes, type }) {
  return (await xrpc(session.pds, 'com.atproto.repo.uploadBlob', { jwt: session.jwt, body: bytes, contentType: type })).blob;
}

async function createPost(session, record) {
  return (await xrpc(session.pds, 'com.atproto.repo.createRecord', { jwt: session.jwt, body: { repo: session.did, collection: 'app.bsky.feed.post', record } })).uri;
}

const bskyUrl = (uri) => {
  const [, did, , rkey] = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri) ?? [];
  return did ? `https://bsky.app/profile/${did}/post/${rkey}` : uri;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((err) => {
      console.error(`::error::${err.message}`);
      summary.push(`**Failed:** ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => {
      if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `## Bluesky announcements\n${summary.join('\n')}\n`);
    });
}
