/**
 * The Bluesky post that announces a new post on skiddle.id: the title, a blank line and the link,
 * with the post's share card as a link card, in the post's language. The link card names the post's
 * site.standard.document and publication records (associatedRefs), so Bluesky shows it as a
 * Standard.site card: the publication's name, its author and "View publication", in its colours. The admin app posts it when it
 * publishes a post, and the scheduler (workers/publisher) when it publishes a scheduled one. Plain
 * JavaScript, so both can use it.
 */

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const graphemes = (/** @type {string} */ s) => [...segmenter.segment(s)].length;

/** At most `max` characters (graphemes), ending with … if cut */
function truncate(/** @type {string | undefined} */ s, /** @type {number} */ max) {
  const parts = [...segmenter.segment(s ?? '')].map((x) => x.segment);
  return parts.length <= max ? (s ?? '') : `${parts.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}

/**
 * An app.bsky.feed.post record
 * @param {object} post
 * @param {string} post.title
 * @param {string} [post.description]
 * @param {string} [post.lang] e.g. 'en' (the default) or 'id'
 * @param {string} post.url The post's address on skiddle.id
 * @param {unknown} [post.thumb] The share card, as a blob reference ({ $type: 'blob', ref, mimeType, size })
 * @param {{ uri: string, cid: string }[]} [post.refs] The post's site.standard.document record, then its publication's
 * @param {string} [post.createdAt]
 */
export function announcementRecord({ title, description, lang = 'en', url, thumb, refs = [], createdAt = new Date().toISOString() }) {
  const display = url.replace(/^https:\/\//, '').replace(/\/$/, '');
  // A Bluesky post is at most 300 characters
  const head = truncate(title, 300 - graphemes(display) - 2);
  const enc = new TextEncoder();
  const byteStart = enc.encode(`${head}\n\n`).length;
  return {
    $type: 'app.bsky.feed.post',
    text: `${head}\n\n${display}`,
    createdAt,
    langs: [lang],
    facets: [{ index: { byteStart, byteEnd: byteStart + enc.encode(display).length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }] }],
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: url,
        title,
        description: truncate(description, 300),
        ...(thumb ? { thumb } : {}),
        ...(refs.length ? { associatedRefs: refs.map(({ uri, cid }) => ({ $type: 'com.atproto.repo.strongRef', uri, cid })) } : {}),
      },
    },
  };
}
