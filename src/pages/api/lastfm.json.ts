/*
  /api/lastfm.json: the old address of /api/music.json, from when the sidebar's "now playing" came
  from Last.fm. Kept so anything still asking it gets an answer.
*/
export const prerender = false;
export { GET } from './music.json';
