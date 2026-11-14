/**
 * Astro integration: after the build, renders a share card (Open Graph image)
 *   - for every published post: /og/posts/<slug>.png, from the post page's BlogPosting JSON-LD
 *   - for every other page whose og:image points at /og/pages/<path>.png (see src/layouts/shell.astro):
 *     its title and description, its own terminal command if it shows one, and a post count on lists
 *   - for the home page (and 404): /og/site.png
 * Reading the built pages means drafts are skipped and cards always match what's published.
 */
import type { AstroIntegration } from 'astro';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

        // Page cards, for the pages that ask for one, plus a check that every card a page uses exists
        let pageCount = 0;
        const used = new Map<string, string>(); // card path under /og/ -> a page that uses it
        for (const page of await htmlFiles(fileURLToPath(dir))) {
          const html = await readFile(page, 'utf8');
          const image = /<meta property="og:image" content="[^"]*?\/og\/([^"]+\.png)"/.exec(html)?.[1];
          if (!image) continue;
          used.set(image, page);
          const path = /^pages\/(.+)\.png$/.exec(image)?.[1];
          if (!path) continue;
          const title = meta(html, 'og:title')?.replace(/ — Skiddle$/, '');
          if (!title) continue; // reported below as missing
          // The page's own prompt (e.g. "ls -l projects/"), else a cd into it
          const command = decode(/skiddle@web<\/span>:~\$ ([^<]+)/.exec(html)?.[1]?.trim() ?? '') || `cd ~/${path}`;
          const posts = /^(posts|series|topics)(\/|$)/.test(path) ? new Set(html.match(/href="\/posts\/[a-z0-9-]+\/"/g) ?? []).size : 0;
          const png = await renderShareCard(
            {
              command,
              title,
              description: meta(html, 'og:description'),
              meta: [posts ? `${posts} post${posts === 1 ? '' : 's'}` : ''],
              logo,
            },
            fonts,
          );
          const target = new URL(image, out);
          await mkdir(new URL('.', target), { recursive: true });
          await writeFile(target, png);
          pageCount++;
        }
        for (const [image, page] of used) {
          if (!(await access(new URL(image, out)).then(() => true, () => false))) {
            logger.warn(`Missing share card /og/${image}, used by ${page}`);
          }
        }
        logger.info(`Rendered ${count} post cards, ${pageCount} page cards + site card in ${Date.now() - started}ms`);
      },
    },
  };
}

/** A <meta property="…"> value from the built HTML, with entities decoded */
function meta(html: string, property: string): string | undefined {
  const value = new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(html)?.[1];
  return value === undefined ? undefined : decode(value);
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" };
function decode(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|#x27);/g, (_, e: string) => ENTITIES[e]);
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
