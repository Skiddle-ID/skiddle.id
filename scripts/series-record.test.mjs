// The id.skiddle.series record the admin app's series editor saves (seriesRecord in
// src/lib/post-record.mjs): a series' own RSS feed is on unless the record says `feed: false`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { seriesRecord } from '../src/lib/post-record.mjs';

const at = '2026-11-25T00:00:00.000Z';

describe('seriesRecord, feed', () => {
  it('writes feed: false when the feed is off', () => {
    assert.equal(seriesRecord({ name: 'Lab Notes', feed: false }, {}, at).feed, false);
  });

  it('leaves the field out when the feed is on, or not given', () => {
    assert.ok(!('feed' in seriesRecord({ name: 'Lab Notes', feed: true }, {}, at)));
    assert.ok(!('feed' in seriesRecord({ name: 'Lab Notes' }, {}, at)));
  });

  it('turning the feed back on clears a feed: false saved earlier', () => {
    const previous = seriesRecord({ name: 'Lab Notes', feed: false }, {}, at);
    assert.ok(!('feed' in seriesRecord({ name: 'Lab Notes', feed: true }, previous, at)));
  });
});
