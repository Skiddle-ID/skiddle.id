/**
 * The covers Worker's answers (covers.mjs) against a stand-in for Deezer: `npm run test:unit`,
 * also run in CI.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SEARCH_LIMIT, handle, trimResults, whereFrom } from './covers.mjs';

const cover = 'https://cdn-images.dzcdn.net/images/cover/abc/250x250-000000-80-0-0.jpg';
const SIN = { colo: 'SIN', country: 'SG', open: true };

/** A stand-in for the Worker's outside world: Deezer answers `body` (with `status`); what was asked and logged is kept */
function io(body, status = 200, at = SIN) {
  const asked = [];
  const lines = [];
  return {
    asked,
    lines,
    deezer: async (url) => {
      asked.push(url);
      return new Response(JSON.stringify(body), { status });
    },
    where: async () => at,
    log: (line) => lines.push(line),
  };
}

const get = (path) => new Request(`https://covers${path}`);

test('a search goes to Deezer and comes back trimmed, with where it ran', async () => {
  const w = io({
    data: [{ id: 1, title: '跳楼机', link: 'https://www.deezer.com/track/1', artist: { id: 2, name: 'LBI利比', picture: 'x' }, album: { id: 3, title: '跳楼机', cover_medium: cover, cover_xl: 'y' } }],
    total: 1,
  });
  const res = await handle(get('/deezer/search?q=LBI%E5%88%A9%E6%AF%94%20%E8%B7%B3%E6%A5%BC%E6%9C%BA'), w);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { data: [{ title: '跳楼机', artist: { name: 'LBI利比' }, album: { cover_medium: cover } }], where: SIN });
  const asked = new URL(w.asked[0]);
  assert.equal(asked.origin + asked.pathname, 'https://api.deezer.com/search');
  assert.equal(asked.searchParams.get('q'), 'LBI利比 跳楼机');
  assert.equal(asked.searchParams.get('limit'), String(SEARCH_LIMIT));
  // Its logs say what was searched, what came back and where it ran
  assert.deepEqual(w.lines, ['search "LBI利比 跳楼机": 1 result (SIN, Deezer SG (open))']);
});

test('a search needs a query, and only GET is answered', async () => {
  const w = io({ data: [] });
  assert.equal((await handle(get('/deezer/search?q=%20'), w)).status, 400);
  assert.equal((await handle(new Request('https://covers/deezer/search?q=x', { method: 'POST' }), w)).status, 405);
  assert.equal((await handle(get('/anything-else'), w)).status, 404);
  assert.equal(w.asked.length, 0);
});

test('Deezer failing is an error, not an empty result', async () => {
  assert.equal((await handle(get('/deezer/search?q=x'), io({}, 503))).status, 502);
  // Deezer answers a quota error with 200 and { error }
  const quota = io({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } });
  assert.equal((await handle(get('/deezer/search?q=x'), quota)).status, 502);
  assert.match(quota.lines[0], /Quota limit exceeded/);
});

test('/where says where it runs', async () => {
  const hk = { colo: 'HKG', country: 'HK', open: false };
  assert.deepEqual(await (await handle(get('/where'), io({}, 200, hk))).json(), hk);
});

test('where it runs comes from the trace and Deezer’s /infos', () => {
  assert.deepEqual(whereFrom('fl=1\nh=www.cloudflare.com\ncolo=SIN\nloc=ID\n', { country_iso: 'SG', country: 'Singapore', open: true }), SIN);
  assert.deepEqual(whereFrom('', null), { colo: '', country: '', open: false });
});

test('only the fields the matcher uses are kept, as strings, at most SEARCH_LIMIT', () => {
  assert.deepEqual(trimResults([{ title: 7, artist: null }]), [{ title: '', artist: { name: '' }, album: { cover_medium: '' } }]);
  assert.equal(trimResults(Array.from({ length: 9 }, () => ({}))).length, SEARCH_LIMIT);
  assert.deepEqual(trimResults(undefined), []);
});
