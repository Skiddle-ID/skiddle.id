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
import { aboutPageFromLegacy, cvPageFromLegacy, nowPageFromLegacy, usesPageFromLegacy } from '../src/lib/page-legacy.mjs';
import { aboutFromRecord, cvFromRecord, usesFromRecord } from '../src/lib/page-records.mjs';

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

describe('the Uses page from its old record', () => {
  const record = fixture('uses');
  const converted = usesPageFromLegacy(usesFromRecord(record), meta);
  const page = pageFromRecord(converted);

  it('is one wide block of every section, dated when the record was', () => {
    assert.deepEqual(kinds(page), ['uses']);
    assert.deepEqual([page.width, page.hideHeading, page.updatedAt], ['wide', true, record.updatedAt]);
    const { heading, sections, outro } = page.blocks[0].block;
    assert.equal(heading, 'Uses');
    assert.deepEqual(sections, usesFromRecord(record).uses);
    assert.match(outro, /\[my homelab posts\]\(\/topics\/tag\/homelab\/\)/);
  });

  it('is a valid id.skiddle.page record', () => assertValid(converted));
});

describe('the CV from its old record', () => {
  const record = fixture('cv');
  const { works, highlights } = cvFromRecord(record);
  const converted = cvPageFromLegacy(works, highlights, meta, at);
  const page = pageFromRecord(converted);
  const [header, jobs, skills, grid, education, contact] = page.blocks.map((b) => b.block);

  it('lays out what the page showed, wide, under its own heading', () => {
    assert.deepEqual(kinds(page), ['cvHeader', 'jobs', 'skills', 'projectGrid', 'education', 'cvContact']);
    assert.deepEqual([page.width, page.hideHeading], ['wide', true]);
    assert.deepEqual(page.blocks.map((b) => b.anchor), [undefined, 'experience', 'skills', 'cv-projects', 'education', 'cv-contact']);
  });

  it('the header counts the years from the first role, and shows the highlights without their links', () => {
    const first = Math.min(...record.experience.flatMap((c) => c.positions.map((p) => Number(p.start))).filter(Number.isFinite));
    assert.deepEqual([header.name, header.email, header.github, header.since], [record.name, record.email, record.links.github, first]);
    assert.deepEqual(header.summary, record.summary);
    assert.deepEqual(header.highlights, record.highlights.map(({ value, label }) => ({ value, label })));
  });

  it('keeps every role, and a role still held has no end', () => {
    assert.deepEqual(jobs.jobs.map((c) => c.positions.map((p) => [p.role, p.start, p.end])), record.experience.map((c) => c.positions.map((p) => [p.role, p.start, p.end])));
  });

  it('keeps the skills, the projects, education and certifications', () => {
    assert.deepEqual(skills.groups, record.skills.map(({ title, items }) => ({ title, items })));
    assert.deepEqual(grid.projects, works.selectedProjects);
    assert.deepEqual(grid.others.map((p) => [p.title, p.source]), record.projects.map((p) => [p.title, p.source]));
    assert.deepEqual(education.schools.map((e) => e.degree), record.education.map((e) => e.degree));
    assert.deepEqual(education.certifications, record.certifications.map(({ title, when }) => ({ title, when })));
    assert.deepEqual(contact.links.map((l) => [l.href, l.primary]), [['mailto:work@skiddle.id?subject=Hello%20from%20your%20CV', true], ['/services/', false]]);
  });

  it('is a valid id.skiddle.page record', () => assertValid(converted));
});
