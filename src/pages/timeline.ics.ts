/**
 * /timeline.ics: Jeff's events as a calendar feed (src/lib/timeline.mjs, icsOf), to subscribe to in
 * Apple or Google Calendar. Rough events stay rough, as on /timeline/. Posts, statuses and notes
 * aren't in it: it's a calendar of events. Its links and ids are skiddle.id's, wherever it's served.
 * Rendered on request and cached like the pages.
 */
import type { APIRoute } from 'astro';
import { PAGES_CACHE, getEvents } from '~/lib/page-content';
import { SITE_URL } from '~/lib/standard-site.mjs';
import { icsOf } from '~/lib/timeline.mjs';

export const prerender = false;

export const GET: APIRoute = async ({ cache }) => {
  const events = await getEvents();
  cache.set(PAGES_CACHE);
  return new Response(icsOf(events, { site: SITE_URL }), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="timeline.ics"' },
  });
};
