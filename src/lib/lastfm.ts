/**
 * Last.fm data for /lastfm.svg and /api/lastfm.json.
 *
 * Always uses the configured account (LASTFM_USERNAME) so the API key
 * (Worker secret LASTFM_API_KEY) can't be used to look up other users.
 * Responses are kept in the edge cache (Cache API) so embeds don't turn
 * every view into a Last.fm API call:
 *   - the latest track for 30 seconds
 *   - album art (as a data: URI) for 7 days
 */
import { env } from 'cloudflare:workers';

export interface LastfmTrack {
  username: string;
  name: string;
  artist: string;
  album: string;
  /** Largest artwork URL, or '' when the track has none */
  imageUrl: string;
  isCurrent: boolean;
  /** Unix seconds when the track was scrobbled (absent while it's playing) */
  playedAt?: number;
  trackUrl: string;
  artistUrl: string;
}

const API = 'https://ws.audioscrobbler.com/2.0/';
const RECENT_TTL = 30;
const ART_TTL = 7 * 24 * 60 * 60;
const MAX_ART_BYTES = 256 * 1024;
/** Last.fm's grey star placeholder for tracks without artwork */
const NO_ART = '2a96cbd8b46e442fc41c2b86b821562f';
/** Only fetch artwork from Last.fm's image CDN */
const ART_URL = /^https:\/\/(?:lastfm(?:-img\d?)?\.freetls\.fastly\.net|lastfm-img\d?\.akamaized\.net)\/i\/u\/[^/]+\/([0-9a-f]{32})\.(?:png|jpe?g|webp|gif)$/i;

const edgeCache = (): Cache | undefined => (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;

/** The track playing now, or else the last one scrobbled. Throws if Last.fm can't be reached. */
export async function getRecentTrack(origin: string): Promise<LastfmTrack | null> {
  const username = env.LASTFM_USERNAME;
  const apiKey = env.LASTFM_API_KEY;
  if (!username || !apiKey) throw new Error('LASTFM_USERNAME or LASTFM_API_KEY is not set');

  const cache = edgeCache();
  const key = new Request(`${origin}/__cache/lastfm/recent`);
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return (await hit.json()) as LastfmTrack | null;

  const query = new URLSearchParams({ method: 'user.getrecenttracks', user: username, api_key: apiKey, limit: '1', format: 'json' });
  const res = await fetch(`${API}?${query}`, {
    headers: { 'User-Agent': 'skiddle.id (+https://skiddle.id)' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Last.fm API error ${res.status}`);
  const data = (await res.json()) as { error?: number; message?: string; recenttracks?: { track?: unknown } };
  if (data?.error) throw new Error(`Last.fm API error ${data.error}: ${data.message ?? ''}`);

  const list = data?.recenttracks?.track;
  const tracks = (Array.isArray(list) ? list : list ? [list] : []) as RawTrack[];
  // While something is playing, Last.fm returns it on top of the `limit` scrobbles
  const raw = tracks.find(isNowPlaying) ?? tracks[0];
  const track = raw ? normalise(raw, username) : null;

  await cache
    ?.put(key, new Response(JSON.stringify(track), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${RECENT_TTL}` } }))
    .catch(() => {});
  return track;
}

/** Album art as a data: URI (fits inside an SVG shown through <img>), or undefined. */
export async function getAlbumArt(origin: string, imageUrl: string): Promise<string | undefined> {
  const match = ART_URL.exec(imageUrl);
  if (!match) return undefined;

  const cache = edgeCache();
  const key = new Request(`${origin}/__cache/lastfm/art/${match[1].toLowerCase()}`);
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) return (await hit.text()) || undefined;

  // Last.fm's image server resizes and converts on the fly: a 174px JPEG (~9 KB) is plenty
  // for the 60px cover on 2x screens. Fall back to the URL Last.fm gave us.
  const candidates = [`${imageUrl.replace(/\/i\/u\/[^/]+\/([^/.]+)\.\w+$/, '/i/u/174s/$1')}.jpg`, imageUrl];
  let uri = '';
  for (const src of candidates) {
    uri = await fetchAsDataUri(src);
    if (uri) break;
  }

  // Failed lookups are remembered too, but only for a minute
  await cache
    ?.put(key, new Response(uri, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': `max-age=${uri ? ART_TTL : 60}` } }))
    .catch(() => {});
  return uri || undefined;
}

async function fetchAsDataUri(src: string): Promise<string> {
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
    const type = (res.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (!res.ok || !/^image\/(?:png|jpeg|webp|gif)$/.test(type)) {
      console.warn(`lastfm art: ${res.status} ${type || 'no type'} for ${src}`);
      return '';
    }
    const bytes = await res.arrayBuffer();
    return bytes.byteLength > 0 && bytes.byteLength <= MAX_ART_BYTES ? `data:${type};base64,${toBase64(bytes)}` : '';
  } catch (err) {
    console.warn(`lastfm art: ${String(err)} for ${src}`);
    return '';
  }
}

type RawTrack = {
  name?: string;
  url?: string;
  artist?: { '#text'?: string; name?: string };
  album?: { '#text'?: string };
  image?: { '#text'?: string; size?: string }[];
  date?: { uts?: string };
  '@attr'?: { nowplaying?: string | boolean };
};

const isNowPlaying = (t: RawTrack) => t?.['@attr']?.nowplaying === 'true' || t?.['@attr']?.nowplaying === true;

function normalise(t: RawTrack, username: string): LastfmTrack {
  const artist = String(t.artist?.['#text'] ?? t.artist?.name ?? '') || 'Unknown Artist';
  const image = String((Array.isArray(t.image) ? t.image.at(-1)?.['#text'] : '') ?? '');
  const uts = Number(t.date?.uts);
  return {
    username,
    name: String(t.name ?? '') || 'Unknown Track',
    artist,
    album: String(t.album?.['#text'] ?? ''),
    imageUrl: image && !image.includes(NO_ART) ? image : '',
    isCurrent: isNowPlaying(t),
    playedAt: Number.isFinite(uts) && uts > 0 ? uts : undefined,
    trackUrl: String(t.url ?? '') || `https://www.last.fm/user/${encodeURIComponent(username)}`,
    artistUrl: `https://www.last.fm/music/${encodeURIComponent(artist)}`,
  };
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
