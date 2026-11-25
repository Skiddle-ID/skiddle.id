// The latest Bluesky post card (src/lib/bluesky-card.ts): a valid SVG for any post, its text
// wrapped to two lines, what it carries named, and a card that links the profile when there's no post.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import { renderBlueskyCard } from '../src/lib/bluesky-card.ts';
import { textColumns } from '../src/lib/embed-card.ts';

const NOW = Date.parse('2026-11-25T12:00:00Z') / 1000;
const post = (text, extra = {}) => ({ text, createdAt: '2026-11-25T06:40:51.224Z', replies: 1, reposts: 0, likes: 12, attachments: [], ...extra });
const render = (p, options = {}) => renderBlueskyCard(p, { now: NOW, ...options });

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/** Drops the markup inside a <text> element (its <tspan>s), again until none is left */
const stripTags = (s) => {
  let out = s;
  for (let prev; prev !== out; ) [prev, out] = [out, out.replace(/<[^>]*>/g, '')];
  return out;
};
/** The text of each <text> element with `cls`, unescaped */
const texts = (svg, cls) => [...svg.matchAll(new RegExp(`<text [^>]*class="${cls}"[^>]*>(.*?)</text>`, 'g'))].map((m) => unescape(stripTags(m[1])));
const body = (svg) => [...texts(svg, 'b fg'), ...texts(svg, 'b mute')];
const meta = (svg) => texts(svg, 'k').join(' | ') + ' | ' + texts(svg, 'k mute').join(' | ');

/** Parses the SVG as XML (resvg's parser is strict) and fails the test if it isn't valid */
const parse = (svg) => assert.doesNotThrow(() => new Resvg(svg), svg);

describe('renderBlueskyCard', () => {
  it('shows the text, the date and the counts', () => {
    const svg = render(post('Lab Notes #3: My Agents Work While I Sleep\n\nskiddle.id/posts/lab-notes-3'));
    parse(svg);
    assert.deepEqual(body(svg), ['Lab Notes #3: My Agents Work While I Sleep', 'skiddle.id/posts/lab-notes-3']);
    assert.match(meta(svg), /Nov 25, 2026/);
    assert.match(meta(svg), /1 reply · 0 reposts · 12 likes/);
    assert.match(svg, /@skiddle\.blue/);
  });

  it('says "new" for a day', () => {
    assert.match(render(post('hi')), /new · /);
    assert.doesNotMatch(render(post('hi'), { now: NOW + 86_400 }), /new · /);
  });

  it('ends long text with an ellipsis, in two lines', () => {
    const svg = render(post('word '.repeat(80)));
    parse(svg);
    const lines = body(svg);
    assert.equal(lines.length, 2);
    assert.match(lines[1], /…$/);
  });

  it('escapes text with <, & and >', () => {
    const svg = render(post('if a < b && c > d then "yes" & \'no\'', { attachments: [{ kind: 'link', domain: 'a&b.example' }] }));
    parse(svg);
    assert.deepEqual(body(svg), ['if a < b && c > d then "yes" & \'no\'']);
    assert.match(meta(svg), /\[link: a&b\.example\]/);
  });

  it('fits CJK text in the card', () => {
    const svg = render(post('飛行機の操縦を学び始めました。'.repeat(10)));
    parse(svg);
    const lines = body(svg);
    assert.equal(lines.length, 2);
    // The text area is 508px wide; a column of 13px monospace is ~7.9px
    for (const line of lines) assert.ok(textColumns(line) <= 508 / (13 * 0.61), line);
    assert.match(lines[1], /…$/);
  });

  it('names what a post carries next to the date', () => {
    const svg = render(post('Look', { attachments: [{ kind: 'quote' }, { kind: 'images', count: 2 }] }));
    assert.match(meta(svg), /Nov 25, 2026 · \[quote\] \[2 images\]/);
    assert.match(meta(render(post('Look', { attachments: [{ kind: 'images', count: 1 }] }))), /\[image\]/);
  });

  it('shows what a post with no text carries in its place', () => {
    const svg = render(post('', { attachments: [{ kind: 'video' }] }));
    parse(svg);
    assert.deepEqual(body(svg), ['[video]']);
  });

  it('with no post, says so and links the profile', () => {
    const svg = render(null);
    parse(svg);
    assert.deepEqual(body(svg), ['No post to show right now', 'Read @skiddle.blue on Bluesky']);
    assert.match(meta(svg), /bsky\.app\/profile\/skiddle\.blue/);
  });

  it('takes a theme and an accent', () => {
    const svg = render(post('hi'), { theme: 'light', accent: 'pink' });
    parse(svg);
    assert.match(svg, /--bg:#ffffff/);
    assert.match(svg, /--acc:#d02670/);
    assert.doesNotMatch(svg, /prefers-color-scheme/);
  });
});
