// The site's built-in id.skiddle.page records (src/lib/page-legacy.mjs), which a page renders while
// it has no page record and the block editor starts from: each lays out what the page showed and is
// a record the lexicon accepts. (The home page's is in scripts/page-blocks.test.mjs.)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { PAGE_COLLECTION, pageFromRecord } from '../src/lib/page-blocks.mjs';
import { notesPageFromLegacy, nowPageFromLegacy, servicesPageFromLegacy } from '../src/lib/page-legacy.mjs';

const ROOT = join(import.meta.dirname, '..');
const lexicon = JSON.parse(readFileSync(join(ROOT, 'lexicons/id/skiddle/page.json'), 'utf8'));
const assertValid = (record) => new Lexicons([structuredClone(lexicon)]).assertValidRecord(PAGE_COLLECTION, jsonToLex(record));
const at = '2026-11-28T00:00:00.000Z';
const meta = { title: 'T', description: 'D' };
const kinds = (p) => p.blocks.map((b) => b.block.kind);

describe('the Now page from what it showed', () => {
  const converted = nowPageFromLegacy(meta, at);

  it('is its heading and lead over the Now record, which stays where the home page reads it', () => {
    const page = pageFromRecord(converted);
    assert.deepEqual(kinds(page), ['nowFull']);
    assert.equal(page.blocks[0].block.heading, 'Now');
    assert.match(page.blocks[0].block.text, /\[now page\]\(https:\/\/nownownow\.com\/about\)/);
    assert.equal(page.hideHeading, true);
  });

  it('is a valid id.skiddle.page record', () => assertValid(converted));
});

describe('the Services page from what it showed', () => {
  const converted = servicesPageFromLegacy(meta, at);
  const page = pageFromRecord(converted);
  const [intro, services, , , brief] = page.blocks.map((b) => b.block);

  it('lays out what the page showed, wide, under its own heading, with an empty track record that shows nothing', () => {
    assert.deepEqual(kinds(page), ['servicesIntro', 'services', 'steps', 'reviews', 'brief']);
    assert.deepEqual([page.width, page.hideHeading], ['wide', true]);
    assert.deepEqual(converted.blocks[1].block, { $type: 'id.skiddle.page#highlights', label: 'Track record', highlights: [] });
  });

  it('its emails start with the brief, to the address the services block sends to', () => {
    const [email] = intro.links;
    const url = new URL(email.href);
    assert.equal(url.protocol + url.pathname, `mailto:${services.email}`);
    assert.equal(url.searchParams.get('body'), services.brief);
    assert.match(services.brief, /What I need help with:/);
    assert.deepEqual(brief.links.map((l) => l.href), [email.href, 'https://bsky.app/profile/skiddle.blue']);
  });

  it('is a valid id.skiddle.page record', () => assertValid(converted));
});

describe('the Notes page from what it showed', () => {
  const converted = notesPageFromLegacy(meta, at);

  it('is its heading and lead over the notes, which stay where the timeline reads them', () => {
    const page = pageFromRecord(converted);
    assert.deepEqual(kinds(page), ['blueskyPosts']);
    assert.deepEqual([page.blocks[0].block.heading, page.hideHeading, page.width], ['Notes', true, 'narrow']);
    assert.match(page.blocks[0].block.text, /\[my Bluesky\]\(https:\/\/bsky\.app\/profile\/skiddle\.blue\)/);
  });

  it('is a valid id.skiddle.page record', () => assertValid(converted));
});
