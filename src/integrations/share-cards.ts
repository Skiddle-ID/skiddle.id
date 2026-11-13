/**
 * Astro integration: after the build, renders a share card (Open Graph image)
 *   - for every published post: /og/posts/<slug>.png, from the post page's BlogPosting JSON-LD
 *   - for the rest of the site:  /og/site.png
 * Reading the built pages means drafts are skipped and cards always match what's published.
 */
import type { AstroIntegration } from 'astro';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { renderShareCard, type CardFont } from '../lib/share-card';

type BlogPosting = { '@type'?: string; headline?: string; description?: string; datePublished?: string; inLanguage?: string };

export default function shareCards(): AstroIntegration {
  let root: URL;
  return {
    name: 'share-cards',
    hooks: {
      'astro:config:done': ({ config }) => {
        root = config.root;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const started = Date.now();
        const file = (path: string) => fileURLToPath(new URL(path, root));
        const fontFile = (pkg: string, name: string) => readFile(file(`node_modules/@fontsource/${pkg}/files/${name}`));
        const fonts: CardFont[] = [
          { name: 'Geist Mono', weight: 400, data: await fontFile('geist-mono', 'geist-mono-latin-400-normal.woff') },
          { name: 'Geist Mono', weight: 700, data: await fontFile('geist-mono', 'geist-mono-latin-700-normal.woff') },
          // Separate family names: satori only falls back between differently named fonts
          { name: 'Geist Mono Ext', weight: 400, data: await fontFile('geist-mono', 'geist-mono-latin-ext-400-normal.woff') },
          { name: 'Geist Mono Ext', weight: 700, data: await fontFile('geist-mono', 'geist-mono-latin-ext-700-normal.woff') },
          { name: 'Noto Sans Thai', weight: 400, data: await fontFile('noto-sans-thai', 'noto-sans-thai-thai-400-normal.woff') },
          { name: 'Noto Sans Thai', weight: 700, data: await fontFile('noto-sans-thai', 'noto-sans-thai-thai-700-normal.woff') },
        ];
        const logo = `data:image/png;base64,${(await readFile(file('public/android-chrome-192x192.png'))).toString('base64')}`;

        const out = new URL('og/', dir);
        await mkdir(new URL('posts/', out), { recursive: true });

        await writeFile(
          new URL('site.png', out),
          await renderShareCard(
            {
              command: 'whoami',
              title: 'Jeff (Skiddle)',
              description: 'Protocol engineer and founder of Skiddle Labs, in Bangkok. Writing about infra, open protocols, homelab and life.',
              logo,
            },
            fonts,
          ),
        );

        const postsDir = new URL('posts/', dir);
        const slugs = (await readdir(postsDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
        let count = 0;
        for (const slug of slugs) {
          let html: string;
          try {
            html = await readFile(new URL(`${slug}/index.html`, postsDir), 'utf8');
          } catch {
            continue; // not a post page
          }
          const post = findBlogPosting(html);
          if (!post?.headline) continue;
          const minutes = /(\d+) min read/.exec(html)?.[1];
          const date = post.datePublished
            ? new Date(post.datePublished).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
            : '';
          const png = await renderShareCard(
            {
              command: `cat posts/${slug}.md`,
              title: post.headline,
              description: post.description,
              meta: [date, minutes ? `${minutes} min read` : ''],
              logo,
            },
            fonts,
          );
          await writeFile(new URL(`posts/${slug}.png`, out), png);
          count++;
        }
        logger.info(`Rendered ${count} post cards + site card in ${Date.now() - started}ms`);
      },
    },
  };
}

/** The BlogPosting object from the page's JSON-LD script tags, if any */
function findBlogPosting(html: string): BlogPosting | undefined {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : data['@graph'] ?? [data];
      const post = items.find((x: BlogPosting) => x?.['@type'] === 'BlogPosting');
      if (post) return post;
    } catch {
      // ignore malformed blocks
    }
  }
  return undefined;
}
