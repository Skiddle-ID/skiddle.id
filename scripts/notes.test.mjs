// The notes on /notes/ (src/lib/notes.mjs): which of Jeff's posts are notes, the picked posts'
// links, the text with its facets, the attachments, and the pages.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NOTES_PER_PAGE, notesFromRecords, notesPage, pageNumber, pickedRkeys, postRkey, richTextHtml } from '../src/lib/notes.mjs';

const DID = 'did:plc:xaj6j6abvpgwps5v6k4t6clv';
const OTHER = 'did:plc:e5nncb3dr5thdkjir5cfaqfe';

/** Byte offsets of `part` in `text`, as a facet's index */
function at(text, part) {
  const bytes = new TextEncoder().encode(text);
  const needle = new TextEncoder().encode(part);
  for (let i = 0; i + needle.length <= bytes.length; i++) {
    if (needle.every((b, j) => bytes[i + j] === b)) return { byteStart: i, byteEnd: i + needle.length };
  }
  throw new Error(`"${part}" isn't in "${text}"`);
}
const tag = (text, name, part = `#${name}`) => ({ index: at(text, part), features: [{ $type: 'app.bsky.richtext.facet#tag', tag: name }] });
const link = (text, part, uri) => ({ index: at(text, part), features: [{ $type: 'app.bsky.richtext.facet#link', uri }] });
const mention = (text, part, did) => ({ index: at(text, part), features: [{ $type: 'app.bsky.richtext.facet#mention', did }] });

/** A post record as listRecords returns it */
const post = (rkey, text, value = {}) => ({
  uri: `at://${DID}/app.bsky.feed.post/${rkey}`,
  cid: 'bafyrei',
  value: { $type: 'app.bsky.feed.post', text, createdAt: `2026-11-${rkey.slice(-2)}T10:00:00.000Z`, ...value },
});
const tagged = (rkey, text = 'A thought #note') => post(rkey, text, { facets: [tag(text, 'note', text.match(/#note/i)[0])] });
const reply = { root: { uri: `at://${OTHER}/app.bsky.feed.post/3a`, cid: 'x' }, parent: { uri: `at://${OTHER}/app.bsky.feed.post/3a`, cid: 'x' } };
const rkeys = (notes) => notes.map((n) => n.rkey);

describe('which posts are notes', () => {
  it('a post with #note in its text, in any case, or in its tags, newest first', () => {
    const records = [
      tagged('p-01'),
      post('p-02', 'Nothing to see'),
      tagged('p-03', 'Loud #NOTE'),
      post('p-04', 'Tagged quietly', { tags: ['Note'] }),
      post('p-05', 'Another tag #notes', { facets: [tag('Another tag #notes', 'notes')] }),
    ];
    assert.deepEqual(rkeys(notesFromRecords(records, new Set())), ['p-04', 'p-03', 'p-01']);
  });

  it('a "#note" without a tag facet is just text', () => {
    assert.deepEqual(notesFromRecords([post('p-01', 'plain #note')], new Set()), []);
  });

  it('a tagged reply isn’t a note, unless it’s picked', () => {
    const records = [tagged('p-01'), post('p-02', 'A reply #note', { reply, facets: [tag('A reply #note', 'note')] })];
    assert.deepEqual(rkeys(notesFromRecords(records, new Set())), ['p-01']);
    assert.deepEqual(rkeys(notesFromRecords(records, new Set(['p-02']))), ['p-02', 'p-01']);
  });

  it('a picked post shows without the tag, and a pick that isn’t a post shows nothing', () => {
    const records = [post('p-01', 'Old thought'), post('p-02', 'Not picked')];
    assert.deepEqual(rkeys(notesFromRecords(records, new Set(['p-01', 'gone']))), ['p-01']);
  });

  it('each note links to its post on Bluesky and keeps its date', () => {
    const [note] = notesFromRecords([post('3n34khnhjycso', 'x', { tags: ['note'], createdAt: '2026-11-25T06:40:51.224Z' })], new Set());
    assert.equal(note.url, 'https://bsky.app/profile/skiddle.blue/post/3n34khnhjycso');
    assert.equal(note.createdAt, '2026-11-25T06:40:51.224Z');
  });
});

describe('picked posts’ links', () => {
  it('both link forms give the record key', () => {
    assert.equal(postRkey('https://bsky.app/profile/skiddle.blue/post/3n2lvi5kaus2g'), '3n2lvi5kaus2g');
    assert.equal(postRkey(`https://bsky.app/profile/${DID}/post/3n2lvi5kaus2g/`), '3n2lvi5kaus2g');
    assert.equal(postRkey('  https://bsky.app/profile/Skiddle.Blue/post/3n2lvi5kaus2g?ref=x  '), '3n2lvi5kaus2g');
    assert.equal(postRkey(`https://bsky.app/profile/${encodeURIComponent(DID)}/post/3n2lvi5kaus2g`), '3n2lvi5kaus2g');
    assert.equal(postRkey(`at://${DID}/app.bsky.feed.post/3n2lvi5kaus2g`), '3n2lvi5kaus2g');
  });

  it('another account’s post, another collection or anything else gives nothing', () => {
    for (const link of [
      'https://bsky.app/profile/xeiaso.net/post/3n2lvi5kaus2g',
      `at://${OTHER}/app.bsky.feed.post/3n2lvi5kaus2g`,
      `at://${DID}/app.bsky.feed.like/3n2lvi5kaus2g`,
      'https://bsky.app/profile/skiddle.blue',
      'https://evil.example/profile/skiddle.blue/post/3n2lvi5kaus2g',
      'https://bsky.app/profile/skiddle.blue/post/..',
      'https://bsky.app/profile/skiddle.blue/post/%E0%A4%A',
      'not a link',
      '',
    ]) {
      assert.equal(postRkey(link), undefined, link);
    }
  });

  it('the record’s links, ignoring what isn’t one; no record picks nothing', () => {
    const record = { posts: ['https://bsky.app/profile/skiddle.blue/post/3a', `at://${DID}/app.bsky.feed.post/3b`, 'https://bsky.app/profile/xeiaso.net/post/3c', 42, null], updatedAt: '2026-11-25T00:00:00Z' };
    assert.deepEqual([...pickedRkeys(record)], ['3a', '3b']);
    assert.deepEqual([...pickedRkeys(null)], []);
    assert.deepEqual([...pickedRkeys({ posts: 'https://bsky.app/profile/skiddle.blue/post/3a' })], []);
  });
});

describe('a note’s text', () => {
  it('links, mentions and tags become links; #note is muted', () => {
    const text = 'Read skiddle.id/now with @hayden.moe #AtProto #note';
    const html = richTextHtml(text, [
      link(text, 'skiddle.id/now', 'https://skiddle.id/now/'),
      mention(text, '@hayden.moe', 'did:plc:hayden'),
      tag(text, 'AtProto'),
      tag(text, 'note'),
    ]);
    assert.equal(
      html,
      'Read <a href="https://skiddle.id/now/" class="link">skiddle.id/now</a> with ' +
        '<a href="https://bsky.app/profile/did:plc:hayden" class="link">@hayden.moe</a> ' +
        '<a href="https://bsky.app/hashtag/AtProto" class="link">#AtProto</a> ' +
        '<span class="text-[var(--color-muted)]">#note</span>',
    );
  });

  it('HTML in the text, a link or a tag is escaped', () => {
    const text = '<b>bold</b> & "quotes" #a<b> x';
    const html = richTextHtml(text, [tag(text, 'a<b>'), link(text, 'x', 'https://example.com/?a=1&b="2"')]);
    assert.equal(html, '&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quotes&quot; <a href="https://bsky.app/hashtag/a%3Cb%3E" class="link">#a&lt;b&gt;</a> <a href="https://example.com/?a=1&amp;b=%222%22" class="link">x</a>');
  });

  it('a link that isn’t http(s), or a mention that isn’t a DID, stays text', () => {
    const text = 'click me, @who';
    const html = richTextHtml(text, [link(text, 'click me', 'javascript:alert(1)'), mention(text, '@who', '" onclick="x')]);
    assert.equal(html, 'click me, @who');
  });

  it('facets index bytes, so emoji and Thai or Chinese text before them still line up', () => {
    const text = '🛫 บินแล้ว 飞行 see skiddle.id\n#เครื่องบิน done';
    const html = richTextHtml(text, [link(text, 'skiddle.id', 'https://skiddle.id/'), tag(text, 'เครื่องบิน')]);
    assert.equal(
      html,
      '🛫 บินแล้ว 飞行 see <a href="https://skiddle.id/" class="link">skiddle.id</a>\n' +
        `<a href="https://bsky.app/hashtag/${encodeURIComponent('เครื่องบิน')}" class="link">#เครื่องบิน</a> done`,
    );
  });

  it('overlapping, out-of-range, mid-character or broken facets are left out, and the text is all there', () => {
    const text = 'héllo wörld 🙂';
    const first = link(text, 'héllo wörld', 'https://a.example/');
    const facets = [
      first,
      link(text, 'wörld', 'https://b.example/'), // overlaps the first
      { index: { byteStart: 1, byteEnd: 2 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://c.example/' }] }, // inside "é"
      { index: { byteStart: 14, byteEnd: 99 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://d.example/' }] },
      { index: { byteStart: 3, byteEnd: 2 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://e.example/' }] },
      { index: { byteStart: '0', byteEnd: 3 }, features: [] },
      { features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://f.example/' }] },
      null,
      'nonsense',
    ];
    assert.equal(richTextHtml(text, facets), '<a href="https://a.example/" class="link">héllo wörld</a> 🙂');
    assert.equal(richTextHtml(text, 'not a list'), 'héllo wörld 🙂');
    assert.equal(richTextHtml(text, [facets[2], { index: { byteStart: 16, byteEnd: 18 }, features: facets[2].features }]), 'héllo wörld 🙂');
  });

  it('an unknown feature keeps its text', () => {
    const text = 'some text';
    assert.equal(richTextHtml(text, [{ index: at(text, 'some'), features: [{ $type: 'app.bsky.richtext.facet#future' }] }]), 'some text');
  });
});

describe('attachments', () => {
  const blob = (cid) => ({ $type: 'blob', ref: { $link: cid }, mimeType: 'image/jpeg', size: 1 });
  const attachments = (embed) => notesFromRecords([post('p-01', 'x', { tags: ['note'], embed })], new Set())[0].attachments;

  it('images are thumbnails on Bluesky’s CDN with their alt text and size, when the record has it', () => {
    const embed = {
      $type: 'app.bsky.embed.images',
      images: [
        { alt: 'Danang Beach', image: blob('bafkreione'), aspectRatio: { width: 2000, height: 1406 } },
        { alt: '', image: { cid: 'bafkreitwo', mimeType: 'image/jpeg' } },
        { alt: 'no image' },
      ],
    };
    assert.deepEqual(attachments(embed), [
      {
        kind: 'images',
        images: [
          {
            thumb: `https://cdn.bsky.app/img/feed_thumbnail/plain/${DID}/bafkreione@jpeg`,
            fullsize: `https://cdn.bsky.app/img/feed_fullsize/plain/${DID}/bafkreione@jpeg`,
            alt: 'Danang Beach',
            width: 2000,
            height: 1406,
          },
          { thumb: `https://cdn.bsky.app/img/feed_thumbnail/plain/${DID}/bafkreitwo@jpeg`, fullsize: `https://cdn.bsky.app/img/feed_fullsize/plain/${DID}/bafkreitwo@jpeg`, alt: '' },
        ],
      },
    ]);
  });

  it('a link card has its title and domain; one that isn’t http(s) is left out', () => {
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.external', external: { uri: 'https://www.skiddle.id/posts/x/', title: 'X', description: 'd' } }), [
      { kind: 'link', url: 'https://www.skiddle.id/posts/x/', title: 'X', domain: 'skiddle.id' },
    ]);
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.external', external: { uri: 'javascript:alert(1)', title: 'X' } }), []);
  });

  it('a quote links the quoted post, and a quote with media has both', () => {
    const quote = { uri: `at://${OTHER}/app.bsky.feed.post/3q`, cid: 'c' };
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.record', record: quote }), [{ kind: 'record', label: 'quote', url: `https://bsky.app/profile/${OTHER}/post/3q` }]);
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.recordWithMedia', record: { record: quote }, media: { $type: 'app.bsky.embed.video', video: blob('v') } }), [
      { kind: 'record', label: 'quote', url: `https://bsky.app/profile/${OTHER}/post/3q` },
      { kind: 'video', url: 'https://bsky.app/profile/skiddle.blue/post/p-01' },
    ]);
  });

  it('an unknown embed shows nothing', () => {
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.future' }), []);
    assert.deepEqual(attachments({ $type: 'app.bsky.embed.record', record: { uri: `at://${OTHER}/com.example.thing/3x` } }), []);
  });
});

describe('pages of notes', () => {
  const notes = Array.from({ length: 45 }, (_, i) => ({ rkey: `n${i}` }));

  it(`${NOTES_PER_PAGE} to a page, newest first, then the rest`, () => {
    const first = notesPage(notes, 1);
    assert.equal(first.pages, 3);
    assert.deepEqual(rkeys(first.notes), rkeys(notes.slice(0, 20)));
    assert.deepEqual(rkeys(notesPage(notes, 3).notes), ['n40', 'n41', 'n42', 'n43', 'n44']);
  });

  it('page 1 exists with no notes; past the last page there’s none', () => {
    assert.deepEqual(notesPage([], 1), { notes: [], page: 1, pages: 1 });
    assert.equal(notesPage([], 2), null);
    assert.equal(notesPage(notes, 4), null);
    assert.equal(notesPage(notes, 0), null);
  });

  it('?page= is a page number, or not', () => {
    assert.equal(pageNumber(null), 1);
    assert.equal(pageNumber('2'), 2);
    for (const raw of ['', '0', '-1', '1.5', '02', 'two', '9999999']) assert.equal(pageNumber(raw), undefined, raw);
  });
});
