/**
 * The covers Worker's answers (covers.mjs) against a stand-in for Deezer: `npm run test:unit`,
 * also run in CI.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEARCH_LIMIT, handle, trimResults } from './covers.mjs';

const cover = 'https://cdn-images.dzcdn.net/images/cover/abc/250x250-000000-80-0-0.jpg';

/** A stand-in for Deezer that answers `body` (with `status`) and records what was asked */
function deezer(body, status = 200) {
  const asked = [];
  const fetcher = async (url) => {
    asked.push(url);
    return new Response(JSON.stringify(body), { status });
  };
  return { asked, fetcher };
}

const get = (path, headers = {}) => new Request(`https://covers${path}`, { headers });

test('a search goes to Deezer and comes back trimmed, with where it ran', async () => {
  const d = deezer({
    data: [{ id: 1, title: '跳楼机', link: 'https://www.deezer.com/track/1', artist: { id: 2, name: 'LBI利比', picture: 'x' }, album: { id: 3, title: '跳楼机', cover_medium: cover, cover_xl: 'y' } }],
    total: 1,
  });
  const lines = [];
  const res = await handle(get('/deezer/search?q=LBI%E5%88%A9%E6%AF%94%20%E8%B7%B3%E6%A5%BC%E6%9C%BA', { 'cf-placement': 'remote-SIN' }), d.fetcher, (line) => lines.push(line));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { data: [{ title: '跳楼机', artist: { name: 'LBI利比' }, album: { cover_medium: cover } }], placement: 'remote-SIN' });
  const asked = new URL(d.asked[0]);
  assert.equal(asked.origin + asked.pathname, 'https://api.deezer.com/search');
  assert.equal(asked.searchParams.get('q'), 'LBI利比 跳楼机');
  assert.equal(asked.searchParams.get('limit'), String(SEARCH_LIMIT));
  // Its logs say what was searched, what came back and where it ran
  assert.deepEqual(lines, ['search "LBI利比 跳楼机": 1 result (remote-SIN)']);
});

test('a search needs a query, and only GET is answered', async () => {
  const d = deezer({ data: [] });
  assert.equal((await handle(get('/deezer/search?q=%20'), d.fetcher)).status, 400);
  assert.equal((await handle(new Request('https://covers/deezer/search?q=x', { method: 'POST' }), d.fetcher)).status, 405);
  assert.equal((await handle(get('/anything-else'), d.fetcher)).status, 404);
  assert.equal(d.asked.length, 0);
});

test('Deezer failing is an error, not an empty result', async () => {
  assert.equal((await handle(get('/deezer/search?q=x'), deezer({}, 503).fetcher)).status, 502);
  // Deezer answers a quota error with 200 and { error }
  assert.equal((await handle(get('/deezer/search?q=x'), deezer({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } }).fetcher)).status, 502);
});

test('/where says where it ran and the country Deezer sees', async () => {
  const res = await handle(get('/where', { 'cf-placement': 'remote-SIN' }), deezer({ country_iso: 'SG', country: 'Singapore', open: true, upload_token: 'x' }).fetcher);
  assert.deepEqual(await res.json(), { placement: 'remote-SIN', deezer: { country: 'SG', open: true } });
});

test('only the fields the matcher uses are kept, as strings, at most SEARCH_LIMIT', () => {
  assert.deepEqual(trimResults([{ title: 7, artist: null }]), [{ title: '', artist: { name: '' }, album: { cover_medium: '' } }]);
  assert.equal(trimResults(Array.from({ length: 9 }, () => ({}))).length, SEARCH_LIMIT);
  assert.deepEqual(trimResults(undefined), []);
});
