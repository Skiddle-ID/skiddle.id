// /notes/ (src/pages/notes.astro): Jeff's Bluesky posts tagged #note, read from his repo, or the
// empty state while there are none; and a ?page= that isn't there.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BASE } from './lib/preview.mjs';

describe('notes', () => {
  it('/notes/ shows the notes, or how to add one', async () => {
    const res = await fetch(`${BASE}/notes/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<h1[^>]*>Notes<\/h1>/);
    const note = /<a href="https:\/\/bsky\.app\/profile\/skiddle\.blue\/post\/[^"]+"[^>]*>view on Bluesky<\/a>/;
    assert.ok(note.test(html) || /No notes yet/.test(html), 'neither a note nor the empty state');
  });

  for (const page of ['1', '9999', 'x', '-1']) {
    it(`/notes/?page=${page} goes back to /notes/`, async () => {
      const res = await fetch(`${BASE}/notes/?page=${page}`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.equal(new URL(res.headers.get('location'), BASE).pathname, '/notes/');
    });
  }
});
