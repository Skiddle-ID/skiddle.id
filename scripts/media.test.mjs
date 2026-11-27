import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MEDIA_COLLECTION, blobRefsIn, editorHref, mediaItems, mediaMarkdown, sizeLabel } from '../src/lib/media.mjs';

const blob = (cid, mimeType = 'image/png', size = 1000) => ({ $type: 'blob', ref: { $link: cid }, mimeType, size });
const uri = (collection, rkey) => `at://did:plc:x/${collection}/${rkey}`;

describe('media library', () => {
  it('finds the blobs anywhere in a record', () => {
    const v = { coverImage: blob('a'), content: { images: [{ name: 'one', image: blob('b', 'image/jpeg', 5) }] }, old: { cid: 'c', mimeType: 'image/gif' } };
    assert.deepEqual(blobRefsIn(v).map((b) => b.cid), ['a', 'b', 'c']);
    assert.deepEqual(blobRefsIn(v)[1], { cid: 'b', mimeType: 'image/jpeg', size: 5 });
  });

  it('groups the repo’s blobs: the library’s, the site’s, and the rest', () => {
    const items = mediaItems(
      ['x', 'cover', 'up1', 'up2'],
      [
        { collection: 'site.standard.document', uri: uri('site.standard.document', 'p1'), value: { title: 'Lab Notes #3', coverImage: blob('cover') } },
        { collection: MEDIA_COLLECTION, uri: uri(MEDIA_COLLECTION, 'm1'), value: { file: blob('up1'), name: 'old.png', createdAt: '2026-11-01T00:00:00Z' } },
        { collection: MEDIA_COLLECTION, uri: uri(MEDIA_COLLECTION, 'm2'), value: { file: blob('up2'), name: 'new.png', alt: 'A plane', createdAt: '2026-11-27T00:00:00Z' } },
      ],
    );
    assert.deepEqual(items.map((i) => [i.cid, i.group]), [['up2', 'library'], ['up1', 'library'], ['cover', 'site'], ['x', 'elsewhere']]);
    assert.deepEqual(items[0].uses, [{ collection: MEDIA_COLLECTION, rkey: 'm2', label: 'library: new.png' }]);
    assert.equal(items[0].alt, 'A plane');
    assert.equal(items[2].uses[0].label, 'post: Lab Notes #3');
    assert.equal(editorHref(items[2].uses[0]), '#post/p1');
  });

  it('keeps a library upload in the library when a post uses it too', () => {
    const [it0] = mediaItems(['up'], [
      { collection: 'id.skiddle.draft', uri: uri('id.skiddle.draft', 'd1'), value: { title: 'Draft', images: [blob('up')] } },
      { collection: MEDIA_COLLECTION, uri: uri(MEDIA_COLLECTION, 'm1'), value: { file: blob('up') } },
    ]);
    assert.equal(it0.group, 'library');
    assert.equal(it0.uses.length, 2);
  });

  it('writes Markdown and sizes', () => {
    assert.equal(mediaMarkdown('bafkreiabc', 'A [big]\nplane'), '![A \\[big\\] plane](/media/bafkreiabc)');
    assert.equal(sizeLabel(182345), '182 KB');
    assert.equal(sizeLabel(1400000), '1.4 MB');
  });
});
