/**
 * teal.fm's records, as the music card and the sidebar show them (src/lib/music.ts). teal.fm keeps
 * what you listen to as AT Protocol records in your own repo; its scrobbler (piper) writes them.
 *   - fm.teal.feed.play: one record per track played (track, artists, release, when, a link)
 *   - fm.teal.actor.status (key `self`): what's playing now, until its `expiry`. When nothing is,
 *     the scrobbler leaves an empty track, or an expiry that has passed.
 * Plain JavaScript, so the tests can use it (scripts/teal.test.mjs).
 */

export const PLAY_COLLECTION = 'fm.teal.feed.play';
export const STATUS_COLLECTION = 'fm.teal.actor.status';

/**
 * @typedef {object} PlayView A play, as both collections hold it
 * @property {string} [trackName]
 * @property {{ artistName?: string }[]} [artists]
 * @property {string} [releaseName]
 * @property {string} [playedTime] ISO date
 * @property {string} [originUri] The track on the service it was played on, e.g. Apple Music
 */

/**
 * @typedef {object} Track
 * @property {string} name
 * @property {string} artist The artists, joined with ", "
 * @property {string} album
 * @property {boolean} isCurrent Playing now
 * @property {number} [playedAt] Unix seconds when it was played (absent while it's playing)
 * @property {string} trackUrl The track on its service, or '' if the record has no usable link
 */

const text = (/** @type {unknown} */ v) => (typeof v === 'string' ? v.trim() : '');

/** An https link, or '' */
export function httpsUrl(/** @type {unknown} */ v) {
  try {
    const url = new URL(text(v));
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

/**
 * A play as a track, or null if it has no track name
 * @param {PlayView | undefined} v
 * @param {boolean} isCurrent
 * @returns {Track | null}
 */
export function trackOf(v, isCurrent) {
  const name = text(v?.trackName);
  if (!name) return null;
  const artists = Array.isArray(v?.artists) ? v.artists.map((a) => text(a?.artistName)).filter(Boolean) : [];
  const played = Date.parse(text(v?.playedTime));
  return {
    name,
    artist: artists.join(', ') || 'Unknown artist',
    album: text(v?.releaseName),
    isCurrent,
    ...(!isCurrent && Number.isFinite(played) ? { playedAt: Math.floor(played / 1000) } : {}),
    trackUrl: httpsUrl(v?.originUri),
  };
}

/**
 * The track playing now, or else the last one played
 * @param {{ item?: PlayView, expiry?: string } | null | undefined} status fm.teal.actor.status/self
 * @param {PlayView[]} plays The newest fm.teal.feed.play records
 * @param {number} [now] Milliseconds
 * @returns {Track | null}
 */
export function recentTrack(status, plays, now = Date.now()) {
  const playing = status && Date.parse(text(status.expiry)) > now ? trackOf(status.item, true) : null;
  if (playing) return playing;
  const newest = plays
    .filter((p) => text(p?.trackName))
    .sort((a, b) => (Date.parse(text(b.playedTime)) || 0) - (Date.parse(text(a.playedTime)) || 0))[0];
  return trackOf(newest, false);
}

/**
 * An Apple Music track's id and store country from its link, e.g.
 * https://music.apple.com/id/album/rabun-jauh/1885485747?i=1885485750 → { id: '1885485750', country: 'id' }
 * @param {string} url
 * @returns {{ id: string, country: string } | null}
 */
export function appleTrack(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'music.apple.com') return null;
    const country = /^\/([a-z]{2})\//.exec(u.pathname)?.[1] ?? 'us';
    const id = u.searchParams.get('i') ?? /\/song\/[^/]+\/(\d+)$/.exec(u.pathname)?.[1] ?? '';
    return /^\d{1,15}$/.test(id) ? { id, country } : null;
  } catch {
    return null;
  }
}

/**
 * Apple's artwork link at a given size: …/100x100bb.jpg → …/174x174bb.jpg. Only Apple's image
 * servers (*.mzstatic.com, over https).
 * @param {unknown} url artworkUrl100 from Apple's lookup API
 * @param {number} px
 * @returns {string}
 */
export function appleArtwork(url, px) {
  const link = httpsUrl(url);
  if (!link || !/^https:\/\/[a-z0-9-]+\.mzstatic\.com\//.test(link)) return '';
  return link.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/, `/${px}x${px}bb.jpg`);
}
