/**
 * Security headers for server-rendered responses (/lastfm.svg, /api/lastfm.json, robots.txt,
 * webfinger). Static pages and assets get the same headers from public/_headers.
 * Headers a route sets itself (e.g. the Last.fm card's own CSP) are left alone.
 */
import { defineMiddleware } from 'astro:middleware';

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
  // Lock down non-HTML responses (an SVG opened directly in a browser could otherwise run
  // scripts). HTML pages need the site CSP, which is applied to static pages via _headers.
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
