// The pages' content survives the trip to records and back (src/lib/page-records.mjs): what the
// pages read from the PDS (src/lib/page-content.ts) is exactly what the data files say today. Also
// what a malformed record does: a missing required field throws, a field of the wrong type is
// left out.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aboutFromRecord,
  aboutRecord,
  cvFromRecord,
  cvRecord,
  projectFromRecord,
  projectRecords,
  projectUri,
  projectsFromRecords,
  servicesFromRecord,
  servicesRecord,
  usesFromRecord,
  usesRecord,
} from '../src/lib/page-records.mjs';
import { DID } from '../src/lib/standard-site.mjs';
import about from '../src/data/about.ts';
import highlights from '../src/data/highlights.ts';
import projects from '../src/data/projects.ts';
import services from '../src/data/services.ts';
import uses, { usesUpdated } from '../src/data/uses.ts';
import works from '../src/data/works.ts';

const at = '2026-11-18T00:00:00.000Z';

describe('page records, there and back', () => {
  it('projects, in the order they were imported, whatever order the PDS lists them in', () => {
    // The import writes them one at a time, in the data file's order
    const records = [...projectRecords(projects, at)].map(([rkey, value], i) => ({
      uri: projectUri(rkey),
      value: { ...value, createdAt: new Date(Date.parse(at) + i * 300).toISOString() },
    }));
    assert.deepEqual(projectsFromRecords([...records].reverse()), projects);
    assert.deepEqual(projectsFromRecords([...records].sort((a, b) => a.uri.localeCompare(b.uri))), projects);
  });

  it('the CV and its highlights', () => {
    assert.deepEqual(cvFromRecord(cvRecord(works, highlights, at)), { works, highlights });
  });

  it('services and testimonials', () => {
    assert.deepEqual(servicesFromRecord(servicesRecord(services, at)), services);
  });

  it('uses, with its "last updated" month', () => {
    assert.deepEqual(usesFromRecord(usesRecord(uses, usesUpdated)), { uses, usesUpdated });
  });

  it('About', () => {
    assert.deepEqual(aboutFromRecord(aboutRecord(about, at)), about);
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
