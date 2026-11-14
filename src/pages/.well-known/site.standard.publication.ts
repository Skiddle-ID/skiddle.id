import { PUBLICATION_URI } from '~/lib/standard-site.mjs';

// Standard.site verification: proves the site.standard.publication record belongs to this domain.
// Readers fetch this and compare the text with the record's at:// URI. Rendered by the Worker
// (not a static file) so it's served as text/plain; src/middleware.ts adds the security headers.
export const prerender = false;

export const GET = () =>
  new Response(PUBLICATION_URI, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
