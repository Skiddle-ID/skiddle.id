// Every post renders the same from its AT Protocol record (the preview, v4) as from git (production,
// v3): body, headings, title, description, structured data, reading time, table of contents and every
// link in the article. Only the share image may differ (records serve the uploaded card), and images'
// src and srcset (see scripts/lib/html-compare.mjs). Remove at the v4 launch, when production renders
// from records too. Skipped when the preview is production.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { firstDifference, headings, pageFacts, proseHtml, tokens } from '../scripts/lib/html-compare.mjs';
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
});
