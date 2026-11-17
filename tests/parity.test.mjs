// The preview (v4, rendering from the AT Protocol records) shows the same posts as production (v3,
// built from git):
//   - every post page: body, headings, title, description, structured data, reading time, table of
//     contents and every link in the article. Only the share image may differ (records serve the
//     uploaded card), and images' src and srcset (see scripts/lib/html-compare.mjs).
//   - the lists (home, posts, series, topics, a tag page): the same post links, in the same order
//   - the feed, the sitemap, the search index and the latest post
// Remove at the v4 launch, when production renders from records too. Skipped when the preview is
// production.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstDifference, headings, pageFacts, proseHtml, tokens } from '../scripts/lib/html-compare.mjs';
import { htmlText } from '../src/lib/post-html.mjs';
import { BASE, eachLimit, pagePaths } from './lib/preview.mjs';

const PRODUCTION = 'https://skiddle.id';
const skip = new URL(BASE).host === new URL(PRODUCTION).host && 'the preview is production';

const page = async (base, path) => {
  const res = await fetch(`${base}${path}?parity=${Date.now()}`);
  assert.ok(res.ok, `${base}${path} answered ${res.status}`);
  return res.text();
};

describe('parity with production', { skip }, () => {
  it('every post renders the same from its record as from git', async () => {
    const posts = (await pagePaths()).filter((p) => /^\/posts\/[^/]+\/$/.test(p));
    assert.ok(posts.length > 0, 'no posts found');
    const problems = [];
    await eachLimit(posts, 4, async (path) => {
      const [preview, production] = await Promise.all([page(BASE, path), page(PRODUCTION, path)]);
      const a = pageFacts(production);
      const b = pageFacts(preview);
      for (const key of Object.keys(a)) {
        if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) problems.push(`${path} ${key}\n    production: ${JSON.stringify(a[key])}\n    preview:    ${JSON.stringify(b[key])}`);
      }
      const builtBody = proseHtml(production) ?? '';
      const previewBody = proseHtml(preview) ?? '';
      const diff = firstDifference(tokens(builtBody), tokens(previewBody));
      if (diff) problems.push(`${path} body, at token ${diff.at}\n    production: ${JSON.stringify(diff.a)}\n    preview:    ${JSON.stringify(diff.b)}`);
      if (headings(builtBody).join('\n') !== headings(previewBody).join('\n')) problems.push(`${path} headings`);
    });
    console.log(`  compared ${posts.length} posts with ${PRODUCTION}`);
    assert.deepEqual(problems.sort(), [], 'differences from production');
  });

  it('the lists link the same posts, in the same order', async () => {
    const problems = [];
    for (const path of ['/', '/posts/', '/series/', '/topics/', '/topics/tag/atproto/']) {
      const [preview, production] = await Promise.all([page(BASE, path), page(PRODUCTION, path)]);
      const links = (html) =>
        [...(/<main\b[\s\S]*<\/main>/.exec(html)?.[0] ?? html).matchAll(/<a\b[^>]*href="(\/posts\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
          (m) => `${m[1]} ${htmlText(m[2]).replace(/\s+/g, ' ').trim()}`,
        );
      const diff = firstDifference(links(production), links(preview));
      if (diff) problems.push(`${path}, at link ${diff.at}\n    production: ${JSON.stringify(diff.a)}\n    preview:    ${JSON.stringify(diff.b)}`);
    }
    assert.deepEqual(problems, [], 'lists that differ from production');
  });

  it('the feed, sitemap, search index and latest post match', async () => {
    const [feedA, feedB, mapA, mapB, searchA, searchB, latestA, latestB] = await Promise.all(
      ['/rss.xml', '/sitemap.xml', '/search.json', '/latest.json'].flatMap((path) => [page(PRODUCTION, path), page(BASE, path)]),
    );
    const items = (xml) => [...xml.matchAll(/<item><title>([\s\S]*?)<\/title><link>([^<]*)<\/link>/g)].map((m) => `${m[2]} ${m[1]}`);
    assert.deepEqual(items(feedB), items(feedA), 'feed items');
    const urls = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]).sort();
    assert.deepEqual(urls(mapB), urls(mapA), 'sitemap URLs');
    const search = (json) => JSON.parse(json).map(({ title, url, date, tags, category, series, description }) => ({ title, url, date, tags, category, series, description }));
    assert.deepEqual(search(searchB), search(searchA), 'search index');
    assert.deepEqual(JSON.parse(latestB), JSON.parse(latestA), 'latest post');
  });
});
