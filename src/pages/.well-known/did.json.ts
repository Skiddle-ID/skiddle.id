import { DID_DOCUMENT } from '~/lib/bluesky-feed.mjs';

// The DID document of did:web:skiddle.id, the feed generator behind each series' Bluesky feed
// (src/lib/bluesky-feed.mjs): Bluesky reads it to find where to ask for a feed. Not the handle's
// DID, which is /.well-known/atproto-did.
export const prerender = false;

export const GET = () =>
  new Response(JSON.stringify(DID_DOCUMENT), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' },
  });
