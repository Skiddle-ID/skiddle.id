import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const base = String(site ?? 'https://skiddle.id');
  const urls = [
    '/',
    '/about',
    '/works',
    '/services',
    '/uses',
    '/posts',
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls
      .map((path) => {
        const loc = new URL(path, base).toString();
        return `<url><loc>${loc}</loc></url>`;
      })
      .join('') +
    `</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
