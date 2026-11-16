// Shared helpers for the preview checks (see README → "Checks").
// PREVIEW_URL is the site to check: a PR's Cloudflare preview in CI, or e.g. http://localhost:8787
// (`npm start` after a build) or https://skiddle.id locally.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

export const BASE = (process.env.PREVIEW_URL || 'http://localhost:8787').replace(/\/+$/, '');

const CHROME = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/** Headless Chrome (the one on the CI runner, or set CHROME_PATH) */
export function launch() {
  const executablePath = CHROME.find((p) => p && existsSync(p));
  if (!executablePath) throw new Error('Chrome not found: set CHROME_PATH');
  return puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
}

/**
 * Paths of the pages to check: everything in the sitemap, plus posts linked from /posts/ that
 * aren't in it (drafts, which previews show), plus the 404 page.
 */
export async function pagePaths() {
  const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const paths = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname));
  const posts = await (await fetch(`${BASE}/posts/`)).text();
  for (const m of posts.matchAll(/href="(\/posts\/[a-z0-9-]+\/)"/g)) paths.add(m[1]);
  paths.add('/this-page-does-not-exist/');
  return [...paths].sort();
}

/** Runs `fn` over `items`, `limit` at a time */
export async function eachLimit(items, limit, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: limit }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}
