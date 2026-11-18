/**
 * Music for /music.svg, /api/music.json and the sidebar's "now playing", from teal.fm's records in
 * Jeff's AT Protocol repo (src/lib/teal.mjs says which). They're read through src/lib/pds.ts, like
 * everything else the site shows, and cached for 30 seconds, so embeds don't turn every view into
 * a request to the PDS. No API key, and nothing about anyone else's listening.
 *
 * Album art isn't in the records. For a track played on Apple Music it comes from Apple's public
 * lookup API (no key), as a data: URI, so it works inside an SVG shown through <img>. It's cached
 * for 7 days per track.
 */
import { appleArtwork, appleTrack, PLAY_COLLECTION, recentTrack, STATUS_COLLECTION, type PlayView, type Track } from '~/lib/teal.mjs';
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

/** The track's cover as a data: URI, or undefined (not an Apple Music track, or no artwork) */
export async function getAlbumArt(trackUrl: string): Promise<string | undefined> {
  const track = appleTrack(trackUrl);
  if (!track) return undefined;
  try {
    // A failure isn't cached (cached() only keeps what loads), so the next view tries again
    return await cached(`art/apple/${track.country}/${track.id}`, ART_TTL, async () => {
      const res = await fetch(`https://itunes.apple.com/lookup?id=${track.id}&country=${track.country}&entity=song`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`Apple lookup ${res.status}`);
      const data = (await res.json()) as { results?: { artworkUrl100?: string }[] };
      const src = appleArtwork(data.results?.find((r) => r.artworkUrl100)?.artworkUrl100, ART_PX);
      if (!src) throw new Error('no artwork');
      const art = await fetch(src, { signal: AbortSignal.timeout(4000) });
      const type = (art.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
      if (!art.ok || !/^image\/(?:png|jpeg|webp|gif)$/.test(type)) throw new Error(`artwork ${art.status} ${type}`);
      const bytes = await art.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_ART_BYTES) throw new Error(`artwork is ${bytes.byteLength} bytes`);
      return `data:${type};base64,${toBase64(bytes)}`;
    });
  } catch (err) {
    console.warn(`music art for ${trackUrl}:`, String(err));
    return undefined;
  }
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
