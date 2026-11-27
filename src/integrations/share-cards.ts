/**
 * Astro integration: after the build, renders a share card (Open Graph image)
 *   - for every other page whose og:image points at /og/pages/<path>.png (see src/layouts/shell.astro):
 *     its title and description, its own terminal command if it shows one, and a post count on lists
 *   - for the post lists rendered on request (/posts/, /series/, /topics/; tag pages share the
 *     Topics card): their title and description from src/data/list-pages.ts, without a post count,
 *     which would go stale between builds
 *   - for the pages built from records (/projects/, /works/, /services/, /uses/, /about/): their
 *     title, description and command from src/data/list-pages.ts
 *   - for the home page (and 404): /og/site.png
 *   - the 88×31 button other sites can link here with: /88x31.png and /88x31-2x.png
 * A post's and a series' card is drawn in the admin app and stored in its record (served from
 * /media/<cid>), so none are drawn here.
 *
 * The cards are in the theme's design, colours and headings' font (id.skiddle.theme) with the
 * publication's logo (site.standard.publication), read from Jeff's repo when the build runs
 * (src/lib/card-theme.mjs, src/lib/site-theme.mjs). If the repo can't be read, they're in today's
 * terminal design with the built-in icon, so a build never fails on it. A change to either shows on
 * these cards from the next deploy.
 */
import type { AstroIntegration } from 'astro';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderButton, renderShareCard, type CardFont } from '../lib/share-card';
import { CONTENT_PAGES, LIST_PAGES } from '../data/list-pages';
import { THEME_COLLECTION, cardDesignOf, cardLogoCid, type CardDesign } from '../lib/card-theme.mjs';
import { DEFAULT_SITE_THEME, cardColors, fontOf, siteThemeOf, type SiteTheme } from '../lib/site-theme.mjs';
import { DID, PUBLICATION_RKEY } from '../lib/standard-site.mjs';

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
        const builtIn = `data:image/png;base64,${(await readFile(file('public/android-chrome-192x192.png'))).toString('base64')}`;
        const { design, logo, theme } = await themeOf(builtIn).catch((err: unknown) => {
          logger.warn(`Couldn’t read the theme or the logo, so the cards use the built-in ones: ${err instanceof Error ? err.message : err}`);
          return { design: 'terminal' as CardDesign, logo: builtIn, theme: DEFAULT_SITE_THEME };
        });
        const heading = theme.fonts.heading;
        const font = fontOf(heading).family;
        const colors = cardColors(theme);
        const fonts: CardFont[] = [
          // The theme's headings' font, when it isn't Geist Mono (satori reads WOFF, not WOFF2)
          ...(heading === 'geist-mono'
            ? []
            : await Promise.all(([400, 700] as const).map(async (weight) => ({ name: font, weight, data: await fontFile(heading, `${heading}-latin-${weight}-normal.woff`) })))),
          { name: 'Geist Mono', weight: 400, data: await fontFile('geist-mono', 'geist-mono-latin-400-normal.woff') },
          { name: 'Geist Mono', weight: 700, data: await fontFile('geist-mono', 'geist-mono-latin-700-normal.woff') },
          // Separate family names: satori only falls back between differently named fonts
          { name: 'Geist Mono Ext', weight: 400, data: await fontFile('geist-mono', 'geist-mono-latin-ext-400-normal.woff') },
          { name: 'Geist Mono Ext', weight: 700, data: await fontFile('geist-mono', 'geist-mono-latin-ext-700-normal.woff') },
          { name: 'Noto Sans Thai', weight: 400, data: await fontFile('noto-sans-thai', 'noto-sans-thai-thai-400-normal.woff') },
          { name: 'Noto Sans Thai', weight: 700, data: await fontFile('noto-sans-thai', 'noto-sans-thai-thai-700-normal.woff') },
        ];
        logger.info(`Share cards: the ${design} design in ${font}, ${logo === builtIn ? 'the built-in logo' : 'the publication’s logo'}`);

        const out = new URL('og/', dir);
        await mkdir(out, { recursive: true });

        await writeFile(
          new URL('site.png', out),
          await renderShareCard(
            {
              command: 'whoami',
              title: 'Jeff (Skiddle)',
              description: 'Protocol engineer and founder of Skiddle Labs, in Bangkok. Writing about infra, open protocols, homelab and life.',
              logo,
              design,
              colors,
              font,
            },
            fonts,
          ),
        );

        // The 88×31 button, at 1× and 2× (no "@2x" in the name: Cloudflare redirects "@" to "%40")
        await writeFile(new URL('88x31.png', dir), await renderButton(fonts, 1));
        await writeFile(new URL('88x31-2x.png', dir), await renderButton(fonts, 2));

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
              design,
              colors,
              font,
            },
            fonts,
          );
          const target = new URL(image, out);
          await mkdir(new URL('.', target), { recursive: true });
          await writeFile(target, png);
          pageCount++;
        }
        // The post lists and the pages built from records are rendered on request, so there's no
        // built page to read
        const onRequest = [
          ...Object.entries(LIST_PAGES).map(([path, page]) => ({ path, ...page, command: `cd ~/${path}` })),
          ...Object.entries(CONTENT_PAGES).map(([path, page]) => ({ path, ...page })),
        ];
        for (const { path, title, description, command } of onRequest) {
          const target = new URL(`pages/${path}.png`, out);
          await mkdir(new URL('.', target), { recursive: true });
          await writeFile(target, await renderShareCard({ command, title, description, meta: [''], logo, design, colors, font }, fonts));
          pageCount++;
        }
        for (const [image, page] of used) {
          if (!(await access(new URL(image, out)).then(() => true, () => false))) {
            logger.warn(`Missing share card /og/${image}, used by ${page}`);
          }
        }
        logger.info(`Rendered ${pageCount} page cards + site card in ${Date.now() - started}ms`);
      },
    },
  };
}

/** How long the build waits for Jeff's repo */
const TIMEOUT_MS = 8000;

/** The theme (its cards' design, and its design) and the publication's logo (a data: URI), or the built-in logo if it has none */
async function themeOf(builtIn: string): Promise<{ design: CardDesign; logo: string; theme: SiteTheme }> {
  const get = async (url: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok && res.status !== 400) throw new Error(`${url}: ${res.status}`);
    return res;
  };
  const doc = (await (await get(`https://plc.directory/${DID}`)).json()) as { service?: { id: string; serviceEndpoint?: string }[] };
  const pds = doc.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint?.replace(/\/+$/, '');
  if (!pds) throw new Error('no PDS in the DID document');
  // A record that isn't there is a 400 RecordNotFound: no theme yet, or no publication
  const record = async (collection: string, rkey: string) => {
    const res = await get(`${pds}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${collection}&rkey=${rkey}`);
    return res.ok ? ((await res.json()) as { value?: unknown }).value : undefined;
  };
  const [theme, publication] = await Promise.all([record(THEME_COLLECTION, 'self'), record('site.standard.publication', PUBLICATION_RKEY)]);
  const cid = cardLogoCid(publication);
  let logo = builtIn;
  if (cid) {
    const res = await get(`${pds}/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=${cid}`);
    if (!res.ok) throw new Error(`the logo: ${res.status}`);
    const type = (publication as { icon: { mimeType: string } }).icon.mimeType;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    logo = `data:${type};base64,${btoa(bin)}`;
  }
  return { design: cardDesignOf(theme), logo, theme: siteThemeOf(theme) };
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
