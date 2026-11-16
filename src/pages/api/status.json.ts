/*
  /api/status.json: Jeff's current status, from the id.skiddle.status record in his AT Protocol
  repo (src/lib/at-status.ts), or src/data/status.ts when that can't be read. The home page uses
  it to keep its status line current; anything else can too.
*/
import type { APIRoute } from 'astro';
import { getStatus } from '~/lib/at-status';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const s = await getStatus(new URL(request.url).origin);
  const body = { available: s.available, text: s.label, location: s.city, timeZone: s.timeZone, updatedAt: s.updatedAt ?? null, source: s.source };
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
