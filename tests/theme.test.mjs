// Light / dark theme: follows the device, remembers a pick that differs from it, survives blocked
// storage, and the command bar's label follows along.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { BASE, launch } from './lib/preview.mjs';

describe('theme', () => {
  let browser;
  let page;
  const scheme = (value) => page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value }]);
  const go = (path = '/') => page.goto(BASE + path, { waitUntil: 'load' });
  const settle = () => new Promise((r) => setTimeout(r, 300));
  const state = () =>
    page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      saved: localStorage.getItem('theme'),
      color: document.getElementById('themeColor')?.content,
      bg: getComputedStyle(document.body).backgroundColor,
    }));

  before(async () => {
    browser = await launch();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await scheme('light');
    await go();
    await page.evaluate(() => localStorage.clear());
  });
  after(() => browser?.close());

  it('first visit on a light device is light', async () => {
    await go();
    const s = await state();
    assert.equal(s.theme, 'light');
    assert.equal(s.color, '#ffffff');
    assert.equal(s.bg, 'rgb(255, 255, 255)');
  });

  it('first visit on a dark device is dark', async () => {
    await scheme('dark');
    await go();
    const s = await state();
    assert.equal(s.theme, 'dark');
    assert.equal(s.color, '#161616');
  });

  it('follows the device switching while the page is open', async () => {
    await scheme('light');
    await settle();
    assert.equal((await state()).theme, 'light');
    await scheme('dark');
    await settle();
    assert.equal((await state()).theme, 'dark');
  });

  it('remembers a pick that differs from the device', async () => {
    await page.click('#themeToggle');
    const s = await state();
    assert.equal(s.theme, 'light');
    assert.equal(s.saved, 'light');
  });

  it('keeps the pick across pages and device switches', async () => {
    await go('/posts/');
    assert.equal((await state()).theme, 'light');
    await scheme('light');
    await settle();
    await scheme('dark');
    await settle();
    assert.equal((await state()).theme, 'light');
  });

  it("forgets the pick when switching back to the device's theme", async () => {
    await page.click('#themeToggle');
    const s = await state();
    assert.equal(s.theme, 'dark');
    assert.equal(s.saved, null);
    await scheme('light');
    await settle();
    assert.equal((await state()).theme, 'light');
  });

  it('a saved dark theme wins on a light device', async () => {
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await go();
    assert.equal((await state()).theme, 'dark');
    await page.evaluate(() => localStorage.clear());
  });

  it('follows the device when storage is blocked', async () => {
    const context = await browser.createBrowserContext();
    const blocked = await context.newPage();
    await blocked.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await blocked.evaluateOnNewDocument(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await blocked.goto(BASE + '/', { waitUntil: 'load' });
    assert.equal(await blocked.evaluate(() => document.documentElement.dataset.theme), 'light');
    await context.close();
  });

  it('the command bar offers the other theme', async () => {
    await scheme('light');
    await go();
    const label = await page.evaluate(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      const input = document.querySelector('dialog input');
      input.value = 'theme';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 300));
      return [...document.querySelectorAll('dialog [role="option"]')].map((o) => o.textContent.trim()).find((t) => /Switch to (dark|light) theme/.test(t));
    });
    assert.match(label ?? '', /Switch to dark theme/);
  });
});
