// Suggestions for the admin app's fields (src/lib/suggest.mjs). `npm run test:unit`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchTags, putTag, ranked, tagAt, valuesAt } from '../src/lib/suggest.mjs';

describe('values at a path', () => {
  const cv = {
    tags: ['infra', ' homelab ', 3],
    tech: { languages: ['Go', 'TypeScript'] },
    experience: [
      { company: 'A', positions: [{ employment: 'Full-time' }, { employment: 'Contract' }] },
      { company: 'B', positions: [{ employment: 'Full-time' }, {}] },
      'not an object',
    ],
  };
  it('reads lists, objects and lists in lists, keeping only text', () => {
    assert.deepEqual(valuesAt(cv, 'tags[]'), ['infra', 'homelab']);
    assert.deepEqual(valuesAt(cv, 'tech.languages[]'), ['Go', 'TypeScript']);
    assert.deepEqual(valuesAt(cv, 'experience[].positions[].employment'), ['Full-time', 'Contract', 'Full-time']);
    assert.deepEqual(valuesAt(cv, 'experience[].company'), ['A', 'B']);
  });
  it('finds nothing where there is nothing', () => {
    assert.deepEqual(valuesAt(cv, 'missing[].x'), []);
    assert.deepEqual(valuesAt(undefined, 'tags[]'), []);
  });
  it('ranks the most used first, then alphabetically, case aside', () => {
    assert.deepEqual(ranked(['Contract', 'Full-time', 'full-time', 'Advisory']), ['Full-time', 'Advisory', 'Contract']);
  });
});

describe('tags', () => {
  const tags = ['atproto', 'astro', 'homelab', 'infra', 'flying'];
  it('finds the tag being typed around the cursor', () => {
    assert.deepEqual(tagAt('atproto, hom', 12), { start: 8, end: 12, typed: 'hom', others: ['atproto'] });
    assert.deepEqual(tagAt('a, b|, c'.replace('|', ''), 4), { start: 2, end: 4, typed: 'b', others: ['a', 'c'] });
  });
  it('suggests tags starting with it, then containing it, but none already there', () => {
    assert.deepEqual(matchTags(tags, 'a', []), ['atproto', 'astro']);
    assert.deepEqual(matchTags(tags, 'ro', []), ['atproto', 'astro']);
    assert.deepEqual(matchTags(tags, 'a', ['astro']), ['atproto']);
    assert.deepEqual(matchTags(tags, '', ['infra'], 3), ['atproto', 'astro', 'homelab']);
    assert.deepEqual(matchTags(tags, 'homelab', []), []);
  });
  it('puts the chosen tag in, ready for the next', () => {
    assert.deepEqual(putTag('atproto, hom', 12, 'homelab'), { value: 'atproto, homelab, ', cursor: 18 });
    assert.deepEqual(putTag('ast', 3, 'astro'), { value: 'astro, ', cursor: 7 });
    assert.deepEqual(putTag('a, inf, c', 6, 'infra'), { value: 'a, infra, c', cursor: 10 });
  });
});
