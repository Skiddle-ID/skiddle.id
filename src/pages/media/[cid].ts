/**
 * /media/<cid>: an image from Jeff's AT Protocol repo (a post's image or share card), by its CID.
 * The CID is the hash of the file, so a response never changes and is cached for a year. Only
 * images are served, and only blobs of this repo (getBlob takes the DID), so this isn't an open proxy.
 */
import type { APIRoute } from 'astro';
import { blobUrl } from '~/lib/pds';

export const prerender = false;

const IMAGE_TYPES = /^image\/(png|jpeg|gif|webp|avif)$/;
// What the PDS gives an uploaded blob: CIDv1, raw codec, SHA-256, base32
const BLOB_CID = /^bafkrei[a-z2-7]{52}$/;

export const GET: APIRoute = async ({ params, request }) => {
  const cid = params.cid ?? '';
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
  if (!BLOB_CID.test(cid)) return notFound();

  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const hit = await cache?.match(request).catch(() => undefined);
  if (hit) return hit;

  const res = await fetch(await blobUrl(cid), { signal: AbortSignal.timeout(8000) }).catch(() => undefined);
  const type = (res?.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (!res?.ok || !IMAGE_TYPES.test(type)) return notFound();
  const out = new Response(res.body, {
    headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' },
  });
  await cache?.put(request, out.clone()).catch(() => {});
  return out;
};
