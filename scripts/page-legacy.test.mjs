// The pages' old records turned into id.skiddle.page records (src/lib/page-legacy.mjs), which each
// page renders until it has a page record and Move to blocks saves as its draft: from the live
// records in scripts/fixtures/, each lays out what the page showed, keeps what it said, and is a
// record the lexicon accepts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { PAGE_COLLECTION, pageFromRecord } from '../src/lib/page-blocks.mjs';
import { aboutPageFromLegacy } from '../src/lib/page-legacy.mjs';
import { aboutFromRecord } from '../src/lib/page-records.mjs';

const ROOT = join(import.meta.dirname, '..');
const fixture = (name) => JSON.parse(readFileSync(join(ROOT, `scripts/fixtures/${name}-record.json`), 'utf8'));
const lexicon = JSON.parse(readFileSync(join(ROOT, 'lexicons/id/skiddle/page.json'), 'utf8'));
const assertValid = (record) => new Lexicons([structuredClone(lexicon)]).assertValidRecord(PAGE_COLLECTION, jsonToLex(record));
const at = '2026-11-28T00:00:00.000Z';
const meta = { title: 'T', description: 'D' };
const kinds = (p) => p.blocks.map((b) => b.block.kind);

describe('the About page from its old record', () => {
  const record = fixture('about');
  const converted = aboutPageFromLegacy(aboutFromRecord(record), meta, at);
  const page = pageFromRecord(converted);

  it('lays out what the page showed, under its own heading', () => {
    assert.deepEqual(kinds(page), ['facts', 'section', 'principles', 'soFar', 'section', 'contact']);
    assert.deepEqual([page.title, page.description, page.hideHeading, page.width], ['T', 'D', true, 'narrow']);
    assert.deepEqual(page.blocks.map((b) => b.anchor), [undefined, undefined, 'how', 'timeline', 'outside', 'hi']);
  });

  it('keeps what the record says', () => {
    const [facts, intro, principles, soFar, outside, contact] = page.blocks.map((b) => b.block);
    assert.equal(facts.heading, 'About me');
    assert.deepEqual(facts.facts, record.profile.map(({ label, value }) => ({ label, value })));
    assert.deepEqual([intro.title, intro.text], ['', record.intro]);
    assert.deepEqual(principles.principles, record.principles.map(({ title, body }) => ({ title, body })));
    assert.deepEqual(soFar.milestones.map((m) => [m.year, m.text, m.href]), record.timeline.map((t) => [t.year, t.text, t.href]));
    assert.equal(soFar.current, record.current);
    assert.deepEqual([outside.title, outside.text], ['Outside of work', record.outside]);
    assert.equal(contact.text, record.contact.blurb);
  });

  it('the first contact link stands out, and every link but email is one of Jeff’s profiles', () => {
    const contact = page.blocks.at(-1).block;
    assert.deepEqual(
      contact.links.map((l) => [l.href, l.me, l.primary]),
      record.contact.links.map((l, i) => [l.url, !l.url.startsWith('mailto:'), i === 0]),
    );
  });

  it('is a valid id.skiddle.page record', () => assertValid(converted));
});
