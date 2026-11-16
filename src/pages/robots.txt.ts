import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const { origin, hostname } = new URL(request.url);
  // Only skiddle.id itself may be indexed: previews (*.workers.dev, which can show drafts) may not
  const live = hostname === 'skiddle.id' || hostname === 'www.skiddle.id';
  const body = live ? `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};