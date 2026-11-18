// What the pages read from their records (src/lib/page-records.mjs): a record in the lexicon's
// shape comes back in the shape the pages use, and a malformed one is handled: a missing required
// field throws, a field of the wrong type is left out. (Until the v4 launch this also checked that
// the data files survived the trip to records and back, exactly.)
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aboutFromRecord,
  cvFromRecord,
  projectFromRecord,
  projectUri,
  projectsFromRecords,
  servicesFromRecord,
  usesFromRecord,
} from '../src/lib/page-records.mjs';
import { DID } from '../src/lib/standard-site.mjs';

const at = '2026-11-18T00:00:00.000Z';

describe('page records, read', () => {
  it('projects come back in the order they were added, whatever order the PDS lists them in', () => {
    const records = ['b', 'c', 'a'].map((rkey, i) => ({
      uri: projectUri(rkey),
      value: { name: rkey.toUpperCase(), description: 'd', source: `https://example.com/${rkey}`, createdAt: new Date(Date.parse(at) + i * 300).toISOString() },
    }));
    const projects = projectsFromRecords([...records].reverse());
    assert.deepEqual(projects.map((p) => p.id), ['b', 'c', 'a']);
    // source is the pages' github
    assert.equal(projects[0].github, 'https://example.com/b');
  });

  it('a position with no end is still the role', () => {
    const { works } = cvFromRecord({ name: 'n', title: 't', experience: [{ company: 'C', positions: [{ role: 'R', start: '2020' }] }], certifications: [{ title: 'X', when: '2024' }] });
    assert.equal(works.experience[0].positions[0].end, 'Present');
    assert.deepEqual(works.certifications, [{ title: 'X', yearOrStatus: '2024' }]);
  });

  it('a testimonial’s service is the pages’ serviceName', () => {
    const s = servicesFromRecord({ services: [{ name: 'S', description: 'd' }], testimonials: [{ quote: 'q', author: 'a', rating: 5, service: 'S' }] });
    assert.deepEqual(s.testimonials, [{ quote: 'q', author: 'a', serviceName: 'S', rating: 5 }]);
  });

  it('uses says when it was last updated as a month and year', () => {
    assert.equal(usesFromRecord({ sections: [], updatedAt: '2025-09-01T00:00:00.000Z' }).usesUpdated, 'September 2025');
  });

  it('About keeps its Markdown as it is', () => {
    assert.equal(aboutFromRecord({ intro: '**Hi**', updatedAt: at }).intro, '**Hi**');
  });
});

describe('malformed records', () => {
  it('a missing required field throws', () => {
    assert.throws(() => projectFromRecord('x', { description: 'no name' }), /project x: no name/);
    assert.throws(() => cvFromRecord({ title: 'no name' }), /the CV: no name/);
    assert.throws(() => aboutFromRecord({ updatedAt: at }), /about: no intro/);
    assert.throws(() => usesFromRecord({ sections: [] }), /uses: no updatedAt/);
    assert.throws(() => usesFromRecord({ sections: [], updatedAt: 'soon' }), /isn't a date/);
  });

  it('a field of the wrong type, or a value the page doesn’t know, is left out', () => {
    const p = projectFromRecord('x', { name: 'X', description: 'd', year: '2024', status: 'paused', tags: 'one', featured: 'yes', tech: { languages: ['go', 3] } });
    assert.deepEqual(p, { id: 'x', name: 'X', description: 'd', tech: { languages: ['go'] } });
  });

  it('a testimonial without a rating from 1 to 5 is left out', () => {
    const s = servicesFromRecord({ services: [], testimonials: [{ quote: 'q', author: 'a', rating: 9 }, { quote: 'q', author: 'b', rating: 4, service: 'S' }] });
    assert.deepEqual(s.testimonials, [{ quote: 'q', author: 'b', serviceName: 'S', rating: 4 }]);
  });

  it('the CV only selects this repo’s projects', () => {
    const { works: w } = cvFromRecord({ name: 'n', title: 't', selectedProjects: [projectUri('a'), `at://did:plc:someone/${'id.skiddle.project'}/b`, `at://${DID}/id.skiddle.cv/self`] });
    assert.deepEqual(w.selectedProjects, ['a']);
  });
});
