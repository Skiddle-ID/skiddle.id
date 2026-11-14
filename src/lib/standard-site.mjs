/**
 * skiddle.id on AT Protocol, with the Standard.site lexicons (https://standard.site): one
 * `site.standard.publication` record for the site and one `site.standard.document` per published
 * post, in the account's repo. Readers such as Leaflet, pckt and docs.surf pick them up.
 *
 * Shared by the site build (the <link> tags in base-head.astro and
 * /.well-known/site.standard.publication) and scripts/standard-site-sync.mjs, which writes the
 * records. Plain JavaScript so the Node script can import it too.
 *
 * Record keys come from the posts themselves, so a page can point at its record before the sync
 * has written it:
 *   - the publication: the fixed TID below
 *   - a post with `rkey:` in its frontmatter (from the WhiteWind days): see MOVE_PCKT_DOCUMENTS
 *   - any other post: a TID made from its pubDate, plus its slug to tell apart posts with the same time
 */

export const DID = 'did:plc:xaj6j6abvpgwps5v6k4t6clv';
export const SITE_URL = 'https://skiddle.id';
export const PUBLICATION_NAME = 'Skiddle';
export const PUBLICATION_DESCRIPTION =
  'Jeff (Skiddle) — protocol engineer in Bangkok, writing about infra, open protocols, homelab and life.';

/**
 * The six posts with an `rkey:` already have a site.standard.document under that key, written by
 * pckt.blog for its "Skiddle Blog" publication (skiddle-blog.pckt.blog), which shows those posts
 * from these records.
 *   false: leave them to pckt; these posts get no record from skiddle.id
 *   true:  move them to the skiddle.id publication (they then disappear from pckt.blog)
 */
export const MOVE_PCKT_DOCUMENTS = false;

const S32 = '234567abcdefghijklmnopqrstuvwxyz';

/**
 * A TID record key: 53 bits of microseconds since 1970, then a 10-bit clock id, as 13 base32-sortable
 * characters (https://atproto.com/specs/tid).
 * @param {number} micros
 * @param {number} clock 0–1023
 */
export function tid(micros, clock) {
  let v = (BigInt(Math.trunc(micros)) << 10n) | BigInt(clock & 1023);
  let out = '';
  for (let i = 0; i < 13; i++) {
    out = S32[Number(v & 31n)] + out;
    v >>= 5n;
  }
  return out;
}

/** @param {string} s */
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Fixed, so it never changes: 1 Jan 2015, when I started blogging */
export const PUBLICATION_RKEY = tid(Date.UTC(2015, 0, 1) * 1000, 0);
export const PUBLICATION_URI = `at://${DID}/site.standard.publication/${PUBLICATION_RKEY}`;

/**
 * The record key of a post's document, or undefined when skiddle.id doesn't publish one for it.
 * @param {{ slug: string, pubDate: Date, rkey?: string }} post
 * @returns {string | undefined}
 */
export function documentRkey({ slug, pubDate, rkey }) {
  if (rkey) return MOVE_PCKT_DOCUMENTS ? rkey : undefined;
  return tid(pubDate.valueOf() * 1000, fnv1a(slug) % 1024);
}

/**
 * @param {{ slug: string, pubDate: Date, rkey?: string }} post
 * @returns {string | undefined}
 */
export function documentUri(post) {
  const rkey = documentRkey(post);
  return rkey && `at://${DID}/site.standard.document/${rkey}`;
}
