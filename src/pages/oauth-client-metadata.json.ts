/*
  /oauth-client-metadata.json: the OAuth client metadata for the admin app (/admin/). Its URL is
  the app's client ID, so Bluesky's sign-in fetches it to learn the app's name, where to send
  Jeff back, and what it may do (src/lib/admin/oauth.ts). Built per host, so it's right on
  skiddle.id, the v4 staging site and every preview.
*/
import type { APIRoute } from 'astro';
import { clientMetadata } from '~/lib/admin/oauth';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const origin = new URL(request.url).origin;
  return new Response(JSON.stringify(clientMetadata(origin), null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
