import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;
// Build-time discovery of static pages under src/pages using Vite's glob import.
function discoverStaticRoutes(): string[] {
  const modules = import.meta.glob(['./**/*.astro', './**/*.md'], { eager: false });
  const files = Object.keys(modules).map((p) => p.replaceAll('\\', '/'));

  const routes = files
    .filter((p) =>
      !p.includes('/_') &&
      !p.includes('/api/') &&
      !p.endsWith('/sitemap.xml.ts') &&
      !p.endsWith('/rss.xml.ts') &&
      !p.endsWith('/robots.txt') &&
      !p.match(/\[[^\]]+\]/) &&
      !p.endsWith('/lastfm.svg.ts')
    )
    .map((p) => {
      let route = p.replace(/^\.{1}\//, '/');
      route = route.replace(/\/index\.(astro|md)$/, '/');
      route = route.replace(/\.(astro|md)$/, '/');
      return route;
    })
    .filter((r) => r !== '/404/');

  return Array.from(new Set(routes)).sort();
}

export const GET: APIRoute = async ({ site, request }) => {
  const requestUrl = new URL(request.url);
  const base = site ? site.toString() : `${requestUrl.origin}/`;
  const urls = discoverStaticRoutes();
  // <lastmod> only where the date is real: each post (updated, else published), and the posts
  // list (its newest change). Other pages get none rather than a made-up date.
  const lastmod = new Map<string, Date>();

  try {
    const posts = await getCollection('posts', ({ data }) => !data.draft);
    for (const p of posts) {
      if (!p.id) continue;
      const path = `/posts/${p.id}/`;
      urls.push(path);
      lastmod.set(path, p.data.updatedDate ?? p.data.pubDate);
    }
    const newest = Math.max(...[...lastmod.values()].map((d) => d.valueOf()));
    if (Number.isFinite(newest)) lastmod.set('/posts/', new Date(newest));
  } catch (_) {}

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls
      .map((path) => {
        const loc = new URL(path, base).toString();
        const date = lastmod.get(path);
        return `<url><loc>${loc}</loc>${date ? `<lastmod>${date.toISOString()}</lastmod>` : ''}</url>`;
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
