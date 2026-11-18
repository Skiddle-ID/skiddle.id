// Post categories (src/lib/categories.mjs): reading Jeff's id.skiddle.categories record, and what
// the admin app's categories editor refuses.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_CATEGORIES, categoriesFromRecord, categoryLabel, categoryProblems, isCategoryId } from '../src/lib/categories.mjs';

describe('categories', () => {
  it('reads the record in order, leaving out what can’t be used', () => {
    const list = categoriesFromRecord({
      categories: [
        { id: 'flying', label: 'Flying', description: 'From Fear to Flight and logbook notes' },
        { id: 'infra', label: '  Infra & delivery ' },
        { id: 'Bad Id', label: 'x' },
        { id: 'tag', label: 'Reserved' },
        { id: 'infra', label: 'A second infra' },
        { id: 'empty', label: '' },
      ],
    });
    assert.deepEqual(list, [
      { id: 'flying', label: 'Flying', description: 'From Fear to Flight and logbook notes' },
      { id: 'infra', label: 'Infra & delivery' },
    ]);
    assert.deepEqual(categoriesFromRecord(null), []);
    assert.deepEqual(categoriesFromRecord({ categories: 'nope' }), []);
  });

  it('an id is lower case letters, digits and hyphens, and not “tag”', () => {
    for (const ok of ['infra', 'atproto', 'self-hosting', 'v4']) assert.equal(isCategoryId(ok), true, ok);
    for (const bad of ['Infra', 'self hosting', '-x', '', 'tag', 'a'.repeat(33), 3]) assert.equal(isCategoryId(bad), false, String(bad));
  });

  it('a label, or the id when the list doesn’t have it', () => {
    assert.equal(categoryLabel(DEFAULT_CATEGORIES, 'homelab'), 'Homelab');
    assert.equal(categoryLabel(DEFAULT_CATEGORIES, 'flying'), 'flying');
  });

  it('the editor refuses bad, reserved and repeated ids, and dropping one posts use', () => {
    const used = new Map([['infra', 5], ['life', 1]]);
    assert.deepEqual(categoryProblems(DEFAULT_CATEGORIES, used), []);
    const problems = categoryProblems([{ id: 'infra' }, { id: 'Flying' }, { id: 'tag' }, { id: 'infra' }], used);
    assert.equal(problems.length, 4);
    assert.match(problems[0], /lower case letters/);
    assert.match(problems[1], /\/topics\/tag\/ is taken/);
    assert.match(problems[2], /Two categories have the id “infra”/);
    assert.match(problems[3], /1 post uses “life”/);
    // A row still being filled in isn't a problem here (the form says "required")
    assert.deepEqual(categoryProblems([...DEFAULT_CATEGORIES, { id: '' }], used), []);
  });
});
