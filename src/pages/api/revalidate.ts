/**
 * POST /api/revalidate: when Jeff's AT Protocol repo has changed, purges the cached records and the
 * cached pages built from them (Astro's route cache, tag "posts"), so a save shows straight away
 * instead of within a minute. The admin app calls it after a save; the cron Worker will after a
 * scheduled publish.
 *
 * It needs no sign-in: it only purges when the repo's latest commit (its revision) differs from the
 * one it last purged for, so calling it at any other time does nothing.
 */
import type { APIRoute } from 'astro';
import { forget, pdsUrl } from '~/lib/pds';
import { POSTS_TAG } from '~/lib/pds-posts';
import { DID } from '~/lib/standard-site.mjs';

export const prerender = false;

const LAST_REV = new Request('https://pds-cache.skiddle.id/last-purged-rev');
let lastRevInMemory: string | undefined;
const edgeCache = (): Cache | undefined => (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const POST: APIRoute = async ({ cache }) => {
  let rev: string | undefined;
  try {
    const res = await fetch(`${await pdsUrl()}/xrpc/com.atproto.sync.getLatestCommit?did=${DID}`, { signal: AbortSignal.timeout(4000) });
    rev = ((await res.json()) as { rev?: string }).rev;
  } catch (err) {
    return json({ purged: false, error: `Couldn't read the repo: ${err instanceof Error ? err.message : err}` }, 502);
  }
  if (!rev) return json({ purged: false, error: 'The repo has no latest commit' }, 502);

  const last = lastRevInMemory ?? (await (await edgeCache()?.match(LAST_REV).catch(() => undefined))?.text());
  if (rev === last) return json({ purged: false, rev, reason: 'The repo hasn’t changed since the last purge' });

  await forget(['list/site.standard.document', 'list/id.skiddle.series', 'record/id.skiddle.status/self']);
  let pages = true;
  try {
    await cache.invalidate({ tags: [POSTS_TAG] });
  } catch (err) {
    pages = false;
    console.error('revalidate: purging pages failed:', err);
  }
  lastRevInMemory = rev;
  await edgeCache()
    ?.put(LAST_REV, new Response(rev, { headers: { 'Cache-Control': 'max-age=31536000' } }))
    .catch(() => {});
  return json({ purged: true, rev, pages });
};

export const ALL: APIRoute = () => json({ error: 'Use POST' }, 405);
