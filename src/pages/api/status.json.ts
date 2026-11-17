/*
  /api/status.json: Jeff's current status, from the id.skiddle.status record in his AT Protocol
  repo (src/lib/at-status.ts), or src/data/status.ts when that can't be read. `state` is available,
  busy, dnd or away (src/lib/status-states.mjs). The home page uses it to keep its status line
  current; anything else can too.
*/
import type { APIRoute } from 'astro';
import { getStatus } from '~/lib/at-status';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const s = await getStatus(new URL(request.url).origin);
  // `available` stays for anything that used it before `state` existed
  const body = {
    state: s.state,
    available: s.state === 'available',
    text: s.label,
    location: s.city,
    timeZone: s.timeZone,
    updatedAt: s.updatedAt ?? null,
    source: s.source,
  };
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
