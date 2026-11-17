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
 *
 * The admin app (/admin/) gets its own policy: the same, plus 'wasm-unsafe-eval' (it runs
 * WebAssembly to draw share cards, src/lib/admin/card.ts; WebAssembly only, not eval), blob:
 * images (the cards it draws and the images it's about to upload, shown before they're stored
 * anywhere), plus the hosts it signs in with and writes to (connect-src): plc.directory (DID lookup), bsky.social (sign-in), Bluesky's PDS
 * hosts (*.bsky.network) and Cloudflare's DNS-over-HTTPS (the lexicon DNS check). Its rule drops
 * the site-wide CSP first (`! Content-Security-Policy`), because two policies would both apply.
 * Moving the account to another PDS means adding that host to ADMIN_CONNECT (src/lib/csp.mjs).
 * Pages rendered on request (posts from the PDS) don't go through _headers: the middleware gives
 * them the same policy, with the hashes of their own inline scripts.
 * Zaraz used to add a 'nonce-…' to script-src that covered the beacon too; with Zaraz and
 * Google Analytics removed there is no nonce, so the beacon's host has to be listed here.
 */
import type { AstroIntegration } from 'astro';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ADMIN_CONNECT, ADMIN_IMG, cspDirectives, inlineScripts } from '../lib/csp.mjs';

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
          for (const script of inlineScripts(html)) hashes.add(`'sha256-${createHash('sha256').update(script).digest('base64')}'`);
        }

        // The directives live in src/lib/csp.mjs, shared with the middleware for pages rendered on request
        const directives = cspDirectives;

        let scriptSrc = [...hashes].sort().join(' ');
        // The admin app runs WebAssembly when it draws a post's share card (src/lib/admin/card.ts)
        const adminScripts = (src: string) => `${src} 'wasm-unsafe-eval'`;
        const adminPolicy = (src: string) => directives(adminScripts(src), ADMIN_CONNECT, ADMIN_IMG);
        const longest = `  Content-Security-Policy: ${adminPolicy(scriptSrc)}`.length;
        if (longest > MAX_LINE) {
          logger.warn(`CSP with ${hashes.size} script hashes is ${longest} chars (limit ${MAX_LINE}); falling back to 'unsafe-inline' for scripts`);
          scriptSrc = "'unsafe-inline'";
        }
        const line = `  Content-Security-Policy: ${directives(scriptSrc)}`;
        const adminRule = ['/admin/*', '  ! Content-Security-Policy', `  Content-Security-Policy: ${adminPolicy(scriptSrc)}`];

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
        lines.push('', ...adminRule);
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
