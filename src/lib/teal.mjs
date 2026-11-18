/**
 * teal.fm's records, as the music card and the sidebar show them (src/lib/music.ts). teal.fm keeps
 * what you listen to as AT Protocol records in your own repo; its scrobbler (piper) writes them.
 *   - fm.teal.feed.play: one record per track played (track, artists, release, when, a link)
 *   - fm.teal.actor.status (key `self`): what's playing now, until its `expiry`. When nothing is,
 *     the scrobbler leaves an empty track, or an expiry that has passed.
 *   - fm.teal.alpha.feed.play: the plays from before teal.fm moved off its alpha lexicons (up to
 *     Feb 22, 2026), with the link in `originUrl`. /listening/ pages back into them.
 * Plain JavaScript, so the tests can use it (scripts/teal.test.mjs).
 */

export const PLAY_COLLECTION = 'fm.teal.feed.play';
export const ALPHA_PLAY_COLLECTION = 'fm.teal.alpha.feed.play';
export const STATUS_COLLECTION = 'fm.teal.actor.status';
/** Where plays are, newest first: the current collection, then the alpha one */
export const PLAY_COLLECTIONS = [PLAY_COLLECTION, ALPHA_PLAY_COLLECTION];

/**
 * @typedef {object} PlayView A play, as both collections hold it
 * @property {string} [trackName]
 * @property {{ artistName?: string }[]} [artists]
 * @property {string} [releaseName]
 * @property {string} [playedTime] ISO date
 * @property {string} [originUri] The track on the service it was played on, e.g. Apple Music
 * @property {string} [originUrl] The same, in the alpha collection
 * @property {string} [isrc] The recording's ISRC
 * @property {string} [releaseMbId] The release's MusicBrainz id; piper writes it as "mbid:<uuid>"
 */

/**
 * @typedef {object} Track
 * @property {string} name
 * @property {string} artist The artists, joined with ", "
 * @property {string[]} artists Each of them
 * @property {string} album
 * @property {boolean} isCurrent Playing now
 * @property {number} [playedAt] Unix seconds when it was played (absent while it's playing)
 * @property {string} trackUrl The track on its service, or '' if the record has no usable link
 * @property {string} [service] Where it was played, from the link: "Apple Music" or "Last.fm"
 * @property {string} [isrc] The recording's ISRC, e.g. IDA682600101, for finding its cover
 * @property {string} [releaseMbId] The release's MusicBrainz id (a UUID), for its cover
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
    artists,
    album: text(v?.releaseName),
    isCurrent,
    ...(!isCurrent && Number.isFinite(played) ? { playedAt: Math.floor(played / 1000) } : {}),
    trackUrl: httpsUrl(v?.originUri ?? v?.originUrl),
    ...(serviceOf(httpsUrl(v?.originUri ?? v?.originUrl)) ? { service: serviceOf(httpsUrl(v?.originUri ?? v?.originUrl)) } : {}),
    ...(isrcOf(v?.isrc) ? { isrc: isrcOf(v?.isrc) } : {}),
    ...(mbidOf(v?.releaseMbId) ? { releaseMbId: mbidOf(v?.releaseMbId) } : {}),
  };
}

/** A MusicBrainz id, without piper's "mbid:" prefix, or '' */
export function mbidOf(/** @type {unknown} */ v) {
  const id = text(v).replace(/^mbid:/i, '').toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? id : '';
}

/** The Cover Art Archive's front cover of a release, 250px (it redirects to the image) */
export const coverArtArchive = (/** @type {string} */ releaseMbId) => `https://coverartarchive.org/release/${releaseMbId}/front-250`;

/** Lower case letters and digits, for comparing names: "Bicara (feat. X)" → "bicara feat x" */
const loose = (/** @type {string} */ s) =>
  s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The cover of the first Deezer search result that is this track, by this artist: the title starts
 * the same way (so "Bunga Maaf - Acoustic" matches "Bunga Maaf"), and the artists overlap. A wrong
 * cover is worse than none, so anything less is no match.
 * @param {{ title?: string, artist?: { name?: string }, album?: { cover_medium?: string } }[]} results
 * @param {{ name: string, artist: string }} track
 * @returns {string}
 */
export function deezerMatch(results, track) {
  const title = loose(track.name);
  const artist = loose(track.artist.split(/,| feat\.? | ft\.? /i)[0] ?? '');
  if (!title || !artist) return '';
  for (const r of results) {
    const t = loose(text(r?.title));
    const a = loose(text(r?.artist?.name));
    if (!t || !a) continue;
    if ((t.startsWith(title) || title.startsWith(t)) && (a.includes(artist) || artist.includes(a))) return deezerCover(r?.album?.cover_medium);
  }
  return '';
}

/** Where a track was played, from its link */
export function serviceOf(/** @type {string} */ url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'music.apple.com' ? 'Apple Music' : host === 'last.fm' ? 'Last.fm' : host === 'open.spotify.com' ? 'Spotify' : '';
  } catch {
    return '';
  }
}

/**
 * Where a page of plays starts: which collection (0 the current one, 1 the alpha one) and the
 * listRecords cursor in it ('' for its newest). Written in /listening/?older=<token> as "1-3lzx…".
 * @param {unknown} token
 * @returns {{ collection: number, cursor: string } | null}
 */
export function parseOlder(token) {
  const m = /^([01])-([A-Za-z0-9._:~-]{0,100})$/.exec(text(token));
  return m ? { collection: Number(m[1]), cursor: m[2] } : null;
}
export const olderToken = (/** @type {number} */ collection, /** @type {string} */ cursor) => `${collection}-${cursor}`;

/**
 * This week in plays: how many in the last 7 days, and the top artists and tracks by plays. An
 * artist counts once per play they're on, so a duet counts for both.
 * @param {Track[]} plays
 * @param {number} [now] Milliseconds
 * @param {number} [top]
 */
export function weekSummary(plays, now = Date.now(), top = 5) {
  const since = now / 1000 - 7 * 24 * 60 * 60;
  const week = plays.filter((p) => p.playedAt !== undefined && p.playedAt >= since);
  /** @type {Map<string, { name: string, count: number }>} */
  const artists = new Map();
  /** @type {Map<string, { name: string, artist: string, count: number }>} */
  const tracks = new Map();
  for (const p of week) {
    for (const a of p.artists?.length ? p.artists : [p.artist]) {
      const key = a.toLowerCase();
      artists.set(key, { name: artists.get(key)?.name ?? a, count: (artists.get(key)?.count ?? 0) + 1 });
    }
    const key = `${p.name.toLowerCase()}\u0000${p.artist.toLowerCase()}`;
    tracks.set(key, { name: p.name, artist: p.artist, count: (tracks.get(key)?.count ?? 0) + 1 });
  }
  const order = (/** @type {{ name: string, count: number }} */ a, /** @type {{ name: string, count: number }} */ b) => b.count - a.count || a.name.localeCompare(b.name);
  return { plays: week.length, artists: [...artists.values()].sort(order).slice(0, top), tracks: [...tracks.values()].sort(order).slice(0, top) };
}

/** An ISRC (two letters, three letters or digits, seven digits), upper case, or '' */
export function isrcOf(/** @type {unknown} */ v) {
  const code = text(v).replace(/-/g, '').toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(code) ? code : '';
}

/**
 * Deezer's cover link from its track lookup (album.cover_medium, 250px), only from Deezer's image
 * servers over https
 * @param {unknown} url
 * @returns {string}
 */
export function deezerCover(url) {
  const link = httpsUrl(url);
  return /^https:\/\/(cdn-images|e-cdns-images)\.dzcdn\.net\/images\/cover\//.test(link) ? link : '';
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
