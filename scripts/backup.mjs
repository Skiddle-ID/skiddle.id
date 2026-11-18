#!/usr/bin/env node
/**
 * Backs up Jeff's AT Protocol repo into a folder:
 *
 *   repo.car       every record, as the PDS exports it (com.atproto.sync.getRepo): what a move to
 *                  another PDS imports
 *   blobs/<cid>    every image and other file the records point to (com.atproto.sync.listBlobs,
 *                  getBlob), named by its CID
 *   plc-log.json   the DID's history from plc.directory: its handles, PDSes and keys
 *   manifest.json  when, from where, what's in it, and each blob's type and size
 *
 *   node scripts/backup.mjs [folder]     default: backup-YYYY-MM-DD (today, UTC)
 *
 * It checks every block of repo.car and every blob against its CID, so a cut-short or changed
 * download fails the backup. A blob the PDS no longer has is listed in the manifest as missing.
 * It refuses to back up a repo with no posts, so a wiped account doesn't replace good backups.
 *
 * Run weekly by .github/workflows/backup.yml, which attaches the folder to the "backups" release
 * as a .tar.gz. It reads only public endpoints, so it needs no password. No dependencies.
 */
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { blobCid } from './lib/blob.mjs';
import { checkCar } from './lib/car.mjs';
import { DID } from '../src/lib/standard-site.mjs';

/** The site's collections, counted in the manifest for a quick look at what's there */
const SITE_COLLECTIONS = ['site.standard.publication', 'site.standard.document', 'id.skiddle.series', 'id.skiddle.draft', 'id.skiddle.status'];
/** Blobs downloaded at a time */
const PARALLEL = 4;

const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GETs a URL, trying again on a network error, a 429 or a 5xx (up to 4 times, waiting longer
 * each time). Returns the last response, which may not be ok.
 * @param {string} url
 */
async function get(url) {
  for (let attempt = 1; ; attempt++) {
    const last = attempt === 4;
    try {
      const res = await fetch(url);
      if (res.ok || last || (res.status !== 429 && res.status < 500)) return res;
      const after = Number(res.headers.get('retry-after'));
      await res.body?.cancel();
      await sleep(after > 0 && after < 120 ? after * 1000 : 2000 * attempt);
    } catch (err) {
      if (last) throw err;
      await sleep(2000 * attempt);
    }
  }
}

/**
 * An XRPC GET on the PDS: the response, or an error with the PDS's message
 * @param {string} pds
 * @param {string} method
 * @param {Record<string, string>} params
 */
async function xrpc(pds, method, params) {
  const res = await get(`${pds}/xrpc/${method}?${new URLSearchParams(params)}`);
  if (res.ok) return res;
  const data = /** @type {any} */ (await res.json().catch(() => ({})));
  throw Object.assign(new Error(`${method}: ${data.message || data.error || `HTTP ${res.status}`}`), { status: res.status, error: data.error });
}

/** @param {string} pds @param {string} method @param {Record<string, string>} params */
const xrpcJson = async (pds, method, params) => /** @type {any} */ (await (await xrpc(pds, method, params)).json());

/**
 * Every value of a paged list (listRecords, listBlobs)
 * @param {(cursor?: string) => Promise<{ items: any[], cursor?: string }>} page
 */
async function all(page) {
  const out = [];
  let cursor;
  do {
    const result = await page(cursor);
    out.push(...result.items);
    cursor = result.items.length ? result.cursor : undefined;
  } while (cursor);
  return out;
}

/**
 * Runs `work` on each item, `limit` at a time
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<void>} work
 */
async function eachParallel(items, limit, work) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

const megabytes = (/** @type {number} */ bytes) => `${(bytes / 1e6).toFixed(1)} MB`;

async function main() {
  const startedAt = new Date();
  const out = resolve(process.argv[2] ?? `backup-${startedAt.toISOString().slice(0, 10)}`);

  // The PDS, from the DID (so a move to another PDS just works), and the DID's history
  const plcLog = /** @type {any[]} */ (await (await get(`https://plc.directory/${DID}/log/audit`)).json());
  const doc = /** @type {any} */ (await (await get(`https://plc.directory/${DID}`)).json());
  const pds = doc.service?.find((/** @type {any} */ s) => s.id === '#atproto_pds')?.serviceEndpoint;
  if (!pds) throw new Error(`no PDS in ${DID}'s DID document`);
  const handle = doc.alsoKnownAs?.[0]?.replace('at://', '');
  console.log(`Backing up ${handle ?? DID} (${DID}) from ${pds}`);

  // The site's records, counted. No posts means something's wrong: keep the old backups.
  /** @type {Record<string, number>} */
  const records = {};
  for (const collection of SITE_COLLECTIONS) {
    const list = await all(async (cursor) => {
      const page = await xrpcJson(pds, 'com.atproto.repo.listRecords', { repo: DID, collection, limit: '100', ...(cursor ? { cursor } : {}) });
      return { items: page.records, cursor: page.cursor };
    });
    records[collection] = list.length;
  }
  if (!records['site.standard.document']) {
    throw new Error('the repo has no posts (site.standard.document), so this backup would replace good ones with an empty one. Not backing it up.');
  }

  // Every record
  const car = new Uint8Array(await (await xrpc(pds, 'com.atproto.sync.getRepo', { did: DID })).arrayBuffer());
  const { root, blocks } = checkCar(car);
  mkdirSync(join(out, 'blobs'), { recursive: true });
  writeFileSync(join(out, 'repo.car'), car);
  console.log(`repo.car: ${megabytes(car.length)}, ${blocks} blocks, commit ${root}`);

  // Every blob
  const cids = await all(async (cursor) => {
    const page = await xrpcJson(pds, 'com.atproto.sync.listBlobs', { did: DID, limit: '1000', ...(cursor ? { cursor } : {}) });
    return { items: page.cids, cursor: page.cursor };
  });
  /** @type {{ cid: string, mimeType: string, size: number }[]} */
  const blobs = [];
  /** @type {{ cid: string, reason: string }[]} */
  const missing = [];
  await eachParallel(cids, PARALLEL, async (cid) => {
    try {
      const res = await xrpc(pds, 'com.atproto.sync.getBlob', { did: DID, cid });
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (blobCid(bytes) !== cid) throw new Error(`blob ${cid} doesn't match its CID`);
      writeFileSync(join(out, 'blobs', cid), bytes);
      blobs.push({ cid, mimeType: res.headers.get('content-type') ?? 'application/octet-stream', size: bytes.length });
    } catch (err) {
      // Gone from the PDS (taken down, or never stored): note it and carry on. Anything else fails.
      const e = /** @type {any} */ (err);
      if (e.status === 404 || e.status === 400) missing.push({ cid, reason: e.message });
      else throw err;
    }
  });
  blobs.sort((a, b) => a.cid.localeCompare(b.cid));
  missing.sort((a, b) => a.cid.localeCompare(b.cid));
  const blobBytes = blobs.reduce((sum, b) => sum + b.size, 0);
  console.log(`blobs: ${blobs.length}, ${megabytes(blobBytes)}${missing.length ? `; ${missing.length} missing on the PDS` : ''}`);

  writeFileSync(join(out, 'plc-log.json'), `${JSON.stringify(plcLog, null, 2)}\n`);
  const manifest = {
    did: DID,
    handle,
    pds,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    commit: root,
    repo: { file: 'repo.car', size: car.length, blocks },
    records,
    blobs: { count: blobs.length, size: blobBytes, files: blobs, missing },
    restore: 'https://github.com/Skiddle-ID/skiddle.id/blob/v4/docs/v4/posts-on-atproto.md#backups',
  };
  writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const counts = Object.entries(records).map(([c, n]) => `${n} ${c}`).join(', ');
  console.log(`Records: ${counts}`);
  console.log(`Wrote ${out}`);

  if (process.env.GITHUB_ACTIONS) {
    for (const m of missing) console.log(`::warning::Blob ${m.cid} is missing on the PDS (${m.reason})`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        [
          `### Backup of ${handle ?? DID}`,
          '',
          `- Every record: ${megabytes(car.length)}, ${blocks} blocks, commit \`${root}\``,
          `- Blobs: ${blobs.length}, ${megabytes(blobBytes)}${missing.length ? ` (${missing.length} missing on the PDS)` : ''}`,
          `- The site's records: ${counts}`,
          '',
        ].join('\n'),
      );
    }
  }
}

main().catch((err) => {
  console.error(`Backup failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
