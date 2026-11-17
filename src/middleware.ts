/**
 * Security headers for server-rendered responses (posts from the PDS, /media/, /lastfm.svg,
 * /api/lastfm.json, robots.txt, webfinger). Static pages and assets get the same headers from
 * public/_headers. Headers a route sets itself (e.g. the Last.fm card's own CSP) are left alone.
 *
 * Rendered HTML pages get the site's CSP (src/lib/csp.mjs), allowing exactly the inline scripts
 * on that page by hash, like the build does for static pages.
 */
import { defineMiddleware } from 'astro:middleware';
import { cspDirectives, inlineScripts } from '~/lib/csp.mjs';

const BASE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=(), browsing-topics=()',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.isPrerendered) return response; // static: headers come from _headers

  // Some responses have immutable headers; copy into a new Response we can modify
  const res = new Response(response.body, response);
  for (const [name, value] of Object.entries(BASE_HEADERS)) {
    if (!res.headers.has(name)) res.headers.set(name, value);
  }
  const type = res.headers.get('Content-Type') ?? '';
  if (!res.headers.has('Content-Security-Policy') && type.startsWith('text/html') && res.body) {
    const html = await res.text();
    const hashes = await Promise.all(inlineScripts(html).map(sha256));
    const page = new Response(html, res);
    page.headers.set('Content-Security-Policy', cspDirectives([...new Set(hashes)].sort().join(' ')));
    return page;
  }
  // Lock down non-HTML responses (an SVG opened directly in a browser could otherwise run scripts)
  if (!res.headers.has('Content-Security-Policy') && !type.startsWith('text/html')) {
    res.headers.set(
      'Content-Security-Policy',
      type.startsWith('image/svg+xml')
        ? "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-ancestors 'none'"
        : "default-src 'none'; frame-ancestors 'none'",
    );
  }
  return res;
});

/** A CSP source for a script: 'sha256-<base64>' */
async function sha256(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return `'sha256-${btoa(String.fromCharCode(...digest))}'`;
}
