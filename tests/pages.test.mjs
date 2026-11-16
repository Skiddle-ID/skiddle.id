// Every page: no JavaScript or console errors, nothing blocked by the Content-Security-Policy, and
// no serious or critical accessibility problems (axe, WCAG 2.1 A and AA). The home page and a post
// are also checked in the dark theme, for colour contrast.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AxePuppeteer } from '@axe-core/puppeteer';
import { BASE, launch, pagePaths } from './lib/preview.mjs';

const paths = await pagePaths();
const darkToo = new Set(['/', paths.find((p) => /^\/posts\/[a-z0-9-]+\/$/.test(p))]);

describe('pages', () => {
  let browser;
  let page;
  let problems = [];

  before(async () => {
    browser = await launch();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    page.on('console', (m) => {
      // Cloudflare Web Analytics' beacon (added on skiddle.id itself) is often blocked by ad blockers
      // and DNS filters; that's the visitor's choice, not a problem with the site
      if (m.type() === 'error' && !/^https:\/\/static\.cloudflareinsights\.com\//.test(m.location()?.url ?? '')) {
        problems.push(`console: ${m.text()}`);
      }
    });
    page.on('pageerror', (e) => problems.push(`script error: ${e.message}`));
  });
  after(() => browser?.close());

  async function check(path, theme) {
    problems = [];
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
    await page.goto(BASE + path, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 300));
    const { violations } = await new AxePuppeteer(page).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    for (const v of violations.filter((v) => !bad.includes(v))) console.log(`  note (${v.impact}) ${path}: ${v.id}: ${v.help}`);
    // A 404 is expected on the 404 page itself
    const errors = problems.filter((p) => !(path.startsWith('/this-page-does-not-exist') && /status of 404/.test(p)));
    assert.deepEqual(errors, [], `${path}: errors in the browser`);
    assert.deepEqual(
      bad.map((v) => `${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')})`),
      [],
      `${path}: accessibility problems`,
    );
  }

  for (const path of paths) {
    it(`${path} (light)`, () => check(path, 'light'));
    if (darkToo.has(path)) it(`${path} (dark)`, () => check(path, 'dark'));
  }
});
