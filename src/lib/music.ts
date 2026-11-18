/**
 * Music for /music.svg, /api/music.json and the sidebar's "now playing", from teal.fm's records in
 * Jeff's AT Protocol repo (src/lib/teal.mjs says which). They're read through src/lib/pds.ts, like
 * everything else the site shows, and cached for 30 seconds, so embeds don't turn every view into
 * a request to the PDS. No API key, and nothing about anyone else's listening.
 *
 * Album art isn't in the records. getAlbumArt() finds it from what a play carries (an ISRC, a
 * MusicBrainz release, the names), from public sources that need no key, as a data: URI, so it
 * works inside an SVG shown through <img>. It's cached for 7 days per track, and a search that
 * found nothing for a day, so a track with no cover doesn't ask again on every view.
 */
import { appleArtwork, appleTrack, coverArtArchive, deezerCover, deezerMatch, mbidOf, musicBrainzCovers, musicBrainzSearches, PLAY_COLLECTION, recentTrack, STATUS_COLLECTION, type PlayView, type Track } from '~/lib/teal.mjs';
import { cached, getRecord, latestRecords } from '~/lib/pds';

export type { Track };

const TTL = 30;
const ART_TTL = 7 * 24 * 60 * 60;
/** How long a search's answer is kept, even when it found nothing */
const SEARCH_TTL = 24 * 60 * 60;
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
 * The track's cover as a data: URI, or undefined, from the first of these that has one:
 *   1. Deezer, by the track's ISRC (plays from Apple Music carry one)
 *   2. the Cover Art Archive, by the release's MusicBrainz id (many plays that come through
 *      Last.fm, i.e. from Spotify, carry one), or else by its release group: the same album's
 *      cover from another of its releases
 *   3. Deezer's search, by artist and track name, only for a result that is this track. Deezer
 *      isn't open in every country, and answers a search from one where it isn't (Hong Kong, where
 *      skiddle.id often runs) with nothing.
 *   4. MusicBrainz's search, by album, then by track, for the Cover Art Archive
 *   5. Apple's lookup API, for an Apple Music track. It refuses requests from Cloudflare's servers
 *      (403), so on skiddle.id it's only the last resort.
 */
export async function getAlbumArt(track: Pick<Track, 'name' | 'artist' | 'album' | 'trackUrl' | 'isrc' | 'releaseMbId'>): Promise<string | undefined> {
  if (track.isrc) {
    const art = await cover(`art/deezer/${track.isrc}`, async () => {
      const data = (await json(`https://api.deezer.com/2.0/track/isrc:${track.isrc}`)) as { error?: unknown; album?: { cover_medium?: string } };
      if (data.error) throw new Error('not on Deezer');
      return deezerCover(data.album?.cover_medium);
    });
    if (art) return art;
  }
  const release = track.releaseMbId;
  if (release) {
    const art = await cover(`art/caa/${release}`, async () => coverArtArchive(release));
    if (art) return art;
    const group = await cover(`art/caa-group/${release}`, () =>
      search(`mb/group/${release}`, async () => {
        const data = (await json(`https://musicbrainz.org/ws/2/release/${release}?fmt=json&inc=release-groups`)) as { 'release-group'?: { id?: string } };
        const id = mbidOf(data['release-group']?.id);
        return id ? [coverArtArchive(id, 'release-group')] : [];
      }),
    );
    if (group) return group;
  }
  if (track.name && track.artist && track.artist !== 'Unknown artist') {
    const query = `${track.artist.split(/,| feat\.? | ft\.? /i)[0]} ${track.name}`;
    const art = await cover(`art/deezer-search/${query.toLowerCase()}`, () =>
      search(`deezer/${query.toLowerCase()}`, async () => {
        const data = (await json(`https://api.deezer.com/search?${new URLSearchParams({ q: query, limit: '5' })}`)) as { data?: Parameters<typeof deezerMatch>[0] };
        const link = deezerMatch(data.data ?? [], track);
        return link ? [link] : [];
      }),
    );
    if (art) return art;
  }
  const searches = musicBrainzSearches(track);
  if (searches.length) {
    const key = `${track.artist}|${track.album}|${track.name}`.toLowerCase();
    const art = await cover(`art/mb-search/${key}`, () =>
      search(`mb/search/${key}`, async () => {
        for (const [i, { entity, query }] of searches.entries()) {
          // MusicBrainz answers more than one request a second from the same address with 503
          if (i) await new Promise((resolve) => setTimeout(resolve, 1100));
          const data = (await json(`https://musicbrainz.org/ws/2/${entity}/?${new URLSearchParams({ query, fmt: 'json', limit: '5' })}`)) as Parameters<typeof musicBrainzCovers>[1];
          const links = musicBrainzCovers(entity, data, track);
          if (links.length) return links;
        }
        return [];
      }),
    );
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
 * The image links a search found, cached for a day under `key` even when it found none, so a track
 * with no cover doesn't send the same search on every view. A search that fails (MusicBrainz
 * answers 503 when it's asked too often) isn't cached, so the next view tries again.
 */
function search(key: string, find: () => Promise<string[]>): Promise<string[]> {
  return cached(`art-search/${key}`, SEARCH_TTL, find);
}

/**
 * A cover as a data: URI, from the first image link `find` gives that loads (the Cover Art Archive
 * answers 404 for a release with no cover), cached for 7 days under `key`. Finding none isn't
 * cached here (cached() only keeps what loads), so the next view tries again.
 */
async function cover(key: string, find: () => Promise<string | string[]>): Promise<string | undefined> {
  try {
    return await cached(key, ART_TTL, async () => {
      const found = await find();
      const links = (Array.isArray(found) ? found : [found]).filter(Boolean);
      if (!links.length) throw new Error('no artwork');
      let problem = '';
      for (const src of links) {
        const art = await fetch(src, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(4000) });
        const type = (art.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
        if (!art.ok || !/^image\/(?:png|jpeg|webp|gif)$/.test(type)) {
          problem = `artwork ${art.status} ${type}`;
          await art.body?.cancel();
          continue;
        }
        const bytes = await art.arrayBuffer();
        if (!bytes.byteLength || bytes.byteLength > MAX_ART_BYTES) {
          problem = `artwork is ${bytes.byteLength} bytes`;
          continue;
        }
        return `data:${type};base64,${toBase64(bytes)}`;
      }
      throw new Error(problem);
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
