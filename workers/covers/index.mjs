/**
 * skiddle-covers: a small Worker, separate from the site, that runs Deezer's search for the album
 * art on the music card and /listening/ (src/lib/music.ts), from a data center near Singapore.
 *
 * Deezer isn't open in every country, and answers a search from one where it isn't with nothing.
 * The site's Worker runs in the data center nearest each visitor; for Jeff that's Hong Kong, where
 * Deezer isn't open. So the site sends the search here, through a service binding (COVERS in
 * ../../wrangler.toml), and placement (wrangler.toml) runs this Worker near Singapore, where it is.
 *
 * It has no URL (workers_dev = false, no routes), so only the site can call it. What it answers is
 * in covers.mjs.
 */
import { handle } from './covers.mjs';

const USER_AGENT = 'skiddle.id (+https://skiddle.id)';

export default {
  /** @param {Request} request */
  async fetch(request) {
    const deezer = (/** @type {string} */ url) => fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
    return handle(request, deezer, (line) => console.log(line));
  },
};
