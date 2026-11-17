/**
 * The site's Content-Security-Policy, shared by the build (src/integrations/security-headers.ts,
 * which writes it into _headers for static pages) and the middleware (src/middleware.ts, which adds
 * it to pages rendered on request, like posts read from the PDS).
 *
 * Scripts are allowed by hash: every inline <script> on the page is hashed (SHA-256), so only those
 * exact scripts (plus /_astro/*.js from this origin) can run. See security-headers.ts for why each
 * source is there. Plain JavaScript; hashing is left to the caller (Node's crypto at build time,
 * Web Crypto in the Worker).
 */

export const SITE_CONNECT = "'self' https://public.api.bsky.app https://cloudflareinsights.com";
export const ADMIN_CONNECT = `${SITE_CONNECT} https://plc.directory https://bsky.social https://*.bsky.network https://cloudflare-dns.com`;

export const SITE_IMG = "'self' data: https:";
/** The admin app also shows images it made in the browser (blob: URLs): share cards it drew, images about to be uploaded */
export const ADMIN_IMG = `${SITE_IMG} blob:`;

/**
 * The policy, given the script-src sources (hashes, or 'unsafe-inline'), connect-src and img-src
 * @param {string} scriptSrc
 * @param {string} [connectSrc]
 * @param {string} [imgSrc]
 */
export function cspDirectives(scriptSrc, connectSrc = SITE_CONNECT, imgSrc = SITE_IMG) {
  return [
    "default-src 'self'",
    `script-src 'self' https://static.cloudflareinsights.com ${scriptSrc}`.trimEnd(),
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * The contents of the page's inline scripts that run (no src; type empty, module or
 * text/javascript), to hash. JSON-LD and other data blocks are skipped. Case-insensitive, and
 * tolerant of `</script >`-style end tags, like the HTML parser.
 * @param {string} html
 * @returns {string[]}
 */
export function inlineScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)) {
    const attrs = m[1] ?? '';
    if (/\ssrc\s*=/i.test(attrs)) continue; // external: covered by 'self'
    const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1];
    if (type && !/^(module|text\/javascript)$/i.test(type)) continue;
    out.push(m[2]);
  }
  return out;
}
