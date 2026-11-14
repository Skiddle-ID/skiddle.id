/**
 * Astro integration: adds a Content-Security-Policy for the static site to dist/client/_headers.
 *
 * Scripts are allowed by hash: after the build, every inline <script> in the built HTML is
 * hashed (SHA-256), so only those exact scripts (plus /_astro/*.js from this origin) can run.
 * Styles keep 'unsafe-inline' because Shiki code blocks and a few elements use style attributes.
 * Other sources match what the site loads today: images from any HTTPS host (avatars, post
 * images), Bluesky's public API for comments, and Cloudflare Web Analytics.
 *
 * Cloudflare injects the Web Analytics beacon into browser HTML responses at the edge (not
 * into curl's, so test with a real browser). It loads from static.cloudflareinsights.com
 * (script-src, with an integrity hash) and reports to cloudflareinsights.com (connect-src).
 * Zaraz used to add a 'nonce-…' to script-src that covered the beacon too; with Zaraz and
 * Google Analytics removed there is no nonce, so the beacon's host has to be listed here.
 */
import type { AstroIntegration } from 'astro';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Cloudflare limits a _headers line to 2,000 characters
const MAX_LINE = 2000;

export default function securityHeaders(): AstroIntegration {
  return {
    name: 'security-headers',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const hashes = new Set<string>();
        let pages = 0;
        for (const file of await htmlFiles(root)) {
          pages++;
          const html = await readFile(file, 'utf8');
          // Case-insensitive, and tolerant of `</script >`-style end tags, like the HTML parser
          for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi)) {
            const attrs = m[1] ?? '';
            if (/\ssrc\s*=/i.test(attrs)) continue; // external: covered by 'self'
            const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(attrs)?.[1];
            if (type && !/^(module|text\/javascript)$/i.test(type)) continue; // JSON-LD and other data blocks don't run
            hashes.add(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
          }
        }

        const directives = (scriptSrc: string) =>
          [
            "default-src 'self'",
            `script-src 'self' https://static.cloudflareinsights.com ${scriptSrc}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://public.api.bsky.app https://cloudflareinsights.com",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "object-src 'none'",
            'upgrade-insecure-requests',
          ].join('; ');

        let csp = directives([...hashes].sort().join(' '));
        let line = `  Content-Security-Policy: ${csp}`;
        if (line.length > MAX_LINE) {
          logger.warn(`CSP with ${hashes.size} script hashes is ${line.length} chars (limit ${MAX_LINE}); falling back to 'unsafe-inline' for scripts`);
          csp = directives("'unsafe-inline'");
          line = `  Content-Security-Policy: ${csp}`;
        }

        // Put the CSP inside the existing `/*` rule from public/_headers: a second rule with the
        // same pattern replaces the first instead of merging with it
        const headersFile = join(root, '_headers');
        const lines = (await readFile(headersFile, 'utf8').catch(() => '')).split('\n');
        const rule = lines.findIndex((l) => l.trim() === '/*');
        if (rule === -1) {
          lines.push('', '/*', line);
        } else {
          let end = rule + 1;
          while (end < lines.length && /^\s+\S/.test(lines[end])) end++;
          lines.splice(end, 0, line);
        }
        await writeFile(headersFile, lines.join('\n'));
        logger.info(`CSP added to _headers: ${hashes.size} inline script hashes from ${pages} pages (${line.length} chars)`);
      },
    },
  };
}

async function htmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(path)));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}
