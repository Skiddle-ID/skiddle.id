/**
 * Music for /music.svg, /api/music.json and the sidebar's "now playing", from teal.fm's records in
 * Jeff's AT Protocol repo (src/lib/teal.mjs says which). They're read through src/lib/pds.ts, like
 * everything else the site shows, and cached for 30 seconds, so embeds don't turn every view into
 * a request to the PDS. No API key, and nothing about anyone else's listening.
 *
 * Album art isn't in the records. It comes from Deezer's public API by the track's ISRC, or else
 * Apple's lookup API for an Apple Music track (neither needs a key), as a data: URI, so it works
 * inside an SVG shown through <img>. It's cached for 7 days per track.
 */
import { appleArtwork, appleTrack, deezerCover, PLAY_COLLECTION, recentTrack, STATUS_COLLECTION, type PlayView, type Track } from '~/lib/teal.mjs';
import { cached, getRecord, latestRecords } from '~/lib/pds';

export type { Track };

const TTL = 30;
const ART_TTL = 7 * 24 * 60 * 60;
const ART_PX = 174;
const MAX_ART_BYTES = 256 * 1024;

/** The track playing now, or else the last one played; null if there's none. Throws if the PDS can't be read. */
export async function getRecentTrack(): Promise<Track | null> {
  const [status, plays] = await Promise.all([
    // A missing or unreadable status just means nothing's playing
    getRecord<{ item?: PlayView; expiry?: string }>(STATUS_COLLECTION, 'self', { ttl: TTL }).catch(() => null),
    latestRecords<PlayView>(PLAY_COLLECTION, 5, { ttl: TTL }),
  ]);
  return recentTrack(status, plays.map((r) => r.value));
}

const USER_AGENT = 'skiddle.id (+https://skiddle.id)';

/**
 * The track's cover as a data: URI, or undefined: from Deezer by the track's ISRC, or else from
 * Apple for an Apple Music track. Apple's lookup API refuses requests from Cloudflare's servers
 * (403), so it's only the fallback.
 */
export async function getAlbumArt(track: Pick<Track, 'trackUrl' | 'isrc'>): Promise<string | undefined> {
  if (track.isrc) {
    const art = await cover(`art/deezer/${track.isrc}`, async () => {
      const data = (await json(`https://api.deezer.com/2.0/track/isrc:${track.isrc}`)) as { error?: unknown; album?: { cover_medium?: string } };
      if (data.error) throw new Error('not on Deezer');
      return deezerCover(data.album?.cover_medium);
    });
    if (art) return art;
  }
  const apple = appleTrack(track.trackUrl);
  if (apple) {
    return cover(`art/apple/${apple.country}/${apple.id}`, async () => {
      const data = (await json(`https://itunes.apple.com/lookup?id=${apple.id}&country=${apple.country}&entity=song`)) as { results?: { artworkUrl100?: string }[] };
      return appleArtwork(data.results?.find((r) => r.artworkUrl100)?.artworkUrl100, ART_PX);
    });
  }
  return undefined;
}

async function json(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} ${res.status}`);
  return res.json();
}

/**
 * A cover as a data: URI, from the image link `find` gives, cached for 7 days under `key`. A
 * failure isn't cached (cached() only keeps what loads), so the next view tries again.
 */
async function cover(key: string, find: () => Promise<string>): Promise<string | undefined> {
  try {
    return await cached(key, ART_TTL, async () => {
      const src = await find();
      if (!src) throw new Error('no artwork');
      const art = await fetch(src, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(4000) });
      const type = (art.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
      if (!art.ok || !/^image\/(?:png|jpeg|webp|gif)$/.test(type)) throw new Error(`artwork ${art.status} ${type}`);
      const bytes = await art.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_ART_BYTES) throw new Error(`artwork is ${bytes.byteLength} bytes`);
      return `data:${type};base64,${toBase64(bytes)}`;
    });
  } catch (err) {
    console.warn(`music art (${key}):`, String(err));
    return undefined;
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
