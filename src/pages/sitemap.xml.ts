import type { APIRoute } from 'astro';
import { getPosts } from '~/atproto/getPosts';

// Build-time discovery of static pages under src/pages using Vite's glob import.
function discoverStaticRoutes(): string[] {
  // Only include .astro/.md files. Exclude dynamic routes [param], and known endpoints/extensions.
  const modules = import.meta.glob(['./**/*.astro', './**/*.md'], { eager: false });
  const files = Object.keys(modules).map((p) => p.replaceAll('\\', '/'));

  const routes = files
    .filter((p) =>
      !p.includes('/_') && // ignore partials/underscored
      !p.includes('/api/') &&
      !p.endsWith('/sitemap.xml.ts') &&
      !p.endsWith('/rss.xml.ts') &&
      !p.endsWith('/robots.txt') &&
      !p.match(/\[[^\]]+\]/) // ignore dynamic routes
    )
    .map((p) => {
      // Convert file path relative to src/pages into a route path
      // e.g., './index.astro' -> '/', './about.astro' -> '/about'
      let route = p.replace(/^\.{1}\//, '/');
      route = route.replace(/\/index\.(astro|md)$/, '/');
      route = route.replace(/\.(astro|md)$/, '');
      return route;
    })
    .filter((r) => r !== '/404');

  // Deduplicate and sort
  return Array.from(new Set(routes)).sort();
}

export const prerender = false;

export const GET: APIRoute = async ({ site, locals, request }) => {
  const requestUrl = new URL(request.url);
  const base = `${requestUrl.origin}/`;
  const urls = discoverStaticRoutes();

  // Fetch dynamic blog posts and include their URLs
  try {
    const posts = await getPosts(locals as any, undefined, false);
    for (const p of posts) {
      if (p?.rkey) {
        urls.push(`/posts/${p.rkey}`);
      }
    }
  } catch (_) {
    // Swallow errors to avoid failing the sitemap if posts fetch is unavailable
  }

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
