// teal.fm's records as the music card and the sidebar show them (src/lib/teal.mjs): what's playing
// now, or else the last track played, and album art links for Apple Music tracks.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appleArtwork, appleTrack, coverArtArchive, deezerCover, deezerMatch, isrcOf, mbidOf, musicBrainzCovers, musicBrainzSearches, olderToken, parseOlder, recentTrack, serviceOf, trackOf, weekSummary } from '../src/lib/teal.mjs';

const now = Date.parse('2026-11-18T08:12:00Z');
const play = (trackName, playedTime, extra = {}) => ({ trackName, playedTime, artists: [{ artistName: 'Bernadya' }], ...extra });

describe('teal.fm records', () => {
  it('a status that hasn’t expired is playing now', () => {
    const status = { item: play('Rabun Jauh', '2026-11-18T08:10:00Z'), expiry: '2026-11-18T08:20:00Z' };
    const t = recentTrack(status, [play('Older', '2026-11-18T08:00:00Z')], now);
    assert.equal(t.name, 'Rabun Jauh');
    assert.equal(t.isCurrent, true);
    assert.equal(t.playedAt, undefined);
  });

  it('an expired or emptied status means the last play, newest first', () => {
    // What piper leaves when a track ends: an empty track, an expiry before its time
    const cleared = { item: { trackName: '', artists: [] }, time: '2026-11-18T08:11:14Z', expiry: '2026-11-18T08:10:14Z' };
    const plays = [play('Older', '2026-11-18T08:04:08Z'), play('Kita Buat Menyenangkan', '2026-11-18T08:11:08Z'), play('', '2026-11-18T08:11:30Z')];
    const t = recentTrack(cleared, plays, now);
    assert.equal(t.name, 'Kita Buat Menyenangkan');
    assert.equal(t.isCurrent, false);
    assert.equal(t.playedAt, Date.parse('2026-11-18T08:11:08Z') / 1000);
    assert.equal(recentTrack({ item: play('Done', '2026-11-18T07:00:00Z'), expiry: '2026-11-18T07:05:00Z' }, plays, now).name, 'Kita Buat Menyenangkan');
  });

  it('nothing to show is null', () => {
    assert.equal(recentTrack(null, [], now), null);
    assert.equal(trackOf({ trackName: '  ' }, false), null);
  });

  it('artists are joined, and only https links are kept', () => {
    const t = trackOf({ trackName: 'Lebih Beruntung Sedikit', artists: [{ artistName: 'Bernadya' }, { artistName: 'Pamungkas' }], originUri: 'javascript:alert(1)' }, false);
    assert.equal(t.artist, 'Bernadya, Pamungkas');
    assert.equal(t.trackUrl, '');
    assert.equal(trackOf({ trackName: 'x', originUri: 'https://music.apple.com/id/album/x/1?i=2' }, false).trackUrl, 'https://music.apple.com/id/album/x/1?i=2');
    assert.equal(trackOf({ trackName: 'x' }, false).artist, 'Unknown artist');
  });

  it('an Apple Music link gives the track’s id and store', () => {
    assert.deepEqual(appleTrack('https://music.apple.com/id/album/rabun-jauh/1885485747?i=1885485750'), { id: '1885485750', country: 'id' });
    assert.deepEqual(appleTrack('https://music.apple.com/us/song/little-things/123456'), { id: '123456', country: 'us' });
    assert.equal(appleTrack('https://open.spotify.com/track/abc'), null);
    assert.equal(appleTrack('https://music.apple.com/id/album/x/1'), null);
  });

  it('a play’s ISRC is kept, for finding its cover', () => {
    assert.equal(trackOf({ trackName: 'x', isrc: 'IDA682600101' }, false).isrc, 'IDA682600101');
    assert.equal(trackOf({ trackName: 'x', isrc: 'not an isrc' }, false).isrc, undefined);
    assert.equal(isrcOf('id-a68-26-00101'), 'IDA682600101');
    assert.equal(isrcOf('IDA6826001'), '');
  });

  it('a release’s MusicBrainz id loses piper’s "mbid:" prefix', () => {
    const t = trackOf({ trackName: 'Ruang Sendiri', releaseMbId: 'mbid:D4B54A2F-c862-4679-8a65-160b808ceb32' }, false);
    assert.equal(t.releaseMbId, 'd4b54a2f-c862-4679-8a65-160b808ceb32');
    assert.equal(mbidOf('mbid:not-a-uuid'), '');
    assert.equal(coverArtArchive(t.releaseMbId), 'https://coverartarchive.org/release/d4b54a2f-c862-4679-8a65-160b808ceb32/front-250');
  });

  it('a Deezer search result counts only if it’s this track by this artist', () => {
    const cover = (n) => `https://cdn-images.dzcdn.net/images/cover/${n}/250x250-000000-80-0-0.jpg`;
    const results = [
      { title: 'Ruang Sendiri (Live)', artist: { name: 'Someone Else' }, album: { cover_medium: cover('a') } },
      { title: 'Ruang Sendiri', artist: { name: 'Tulus' }, album: { cover_medium: cover('b') } },
    ];
    assert.equal(deezerMatch(results, { name: 'Ruang Sendiri', artist: 'Tulus' }), cover('b'));
    // An acoustic or remastered version still finds the song
    assert.equal(deezerMatch([{ title: 'Bunga Maaf', artist: { name: 'Grace Kaitlin' }, album: { cover_medium: cover('c') } }], { name: 'Bunga Maaf - Acoustic', artist: 'Grace Kaitlin' }), cover('c'));
    // The first of several artists, or a featured one, is enough
    assert.equal(deezerMatch([{ title: 'Bicara', artist: { name: 'TheOvertunes' }, album: { cover_medium: cover('d') } }], { name: 'Bicara (feat. Monita Tahalea)', artist: 'TheOvertunes, Monita Tahalea' }), cover('d'));
    assert.equal(deezerMatch([{ title: 'Another Song', artist: { name: 'Tulus' }, album: { cover_medium: cover('e') } }], { name: 'Ruang Sendiri', artist: 'Tulus' }), '');
    assert.equal(deezerMatch([], { name: 'Ruang Sendiri', artist: 'Tulus' }), '');
  });

  it('names in Thai, Korean or Chinese, or with accents, match too', () => {
    const cover = (n) => `https://cdn-images.dzcdn.net/images/cover/${n}/250x250-000000-80-0-0.jpg`;
    assert.equal(deezerMatch([{ title: 'เหงา เหงา (Insomnia)', artist: { name: 'Ink Waruntorn' }, album: { cover_medium: cover('a') } }], { name: 'เหงา เหงา (Insomnia)', artist: 'Ink Waruntorn' }), cover('a'));
    assert.equal(deezerMatch([{ title: '1분 1초', artist: { name: 'Epik High' }, album: { cover_medium: cover('b') } }], { name: '1분 1초 (feat. 타루)', artist: 'Epik High' }), cover('b'));
    assert.equal(deezerMatch([{ title: '曹操', artist: { name: '林俊傑' }, album: { cover_medium: cover('c') } }], { name: '曹操', artist: '林俊傑' }), cover('c'));
    assert.equal(deezerMatch([{ title: 'Halo', artist: { name: 'Beyonce' }, album: { cover_medium: cover('d') } }], { name: 'Halo', artist: 'Beyoncé' }), cover('d'));
    // Another song by the same artist is still no match
    assert.equal(deezerMatch([{ title: '江南', artist: { name: '林俊傑' }, album: { cover_medium: cover('e') } }], { name: '曹操', artist: '林俊傑' }), '');
    // Nor is the same title by an artist in another script
    assert.equal(deezerMatch([{ title: '曹操', artist: { name: 'Someone' }, album: { cover_medium: cover('f') } }], { name: '曹操', artist: '林俊傑' }), '');
  });

  it('MusicBrainz is searched by album, then by track, with quotes escaped', () => {
    assert.deepEqual(musicBrainzSearches({ name: 'Paris', artist: 'Epik High, Someone', album: 'Black Swan Songs' }), [
      { entity: 'release', query: 'release:"Black Swan Songs" AND artist:"Epik High"' },
      { entity: 'recording', query: 'recording:"Paris" AND artist:"Epik High"' },
    ]);
    assert.deepEqual(musicBrainzSearches({ name: 'Selalu Ada di Nadimu - Original Soundtrack From "JUMBO"', artist: 'Bunga Citra Lestari', album: '' }), [
      { entity: 'recording', query: 'recording:"Selalu Ada di Nadimu - Original Soundtrack From \\"JUMBO\\"" AND artist:"Bunga Citra Lestari"' },
    ]);
    assert.deepEqual(musicBrainzSearches({ name: 'Paris', artist: 'Unknown artist', album: 'Black Swan Songs' }), []);
  });

  it('a MusicBrainz result gives covers only for releases that are the play’s', () => {
    const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;
    const credit = (name) => [{ name, artist: { name } }];
    const track = { name: 'Paris', artist: 'Epik High', album: 'Black Swan Songs' };
    // A release search: named like the album and by the artist, then the release groups
    const releases = musicBrainzCovers('release', {
      releases: [
        { id: id(1), title: 'Black Swan Songs', 'artist-credit': credit('Epik High'), 'release-group': { id: id(9) } },
        { id: id(2), title: 'Black Swan Songs', 'artist-credit': credit('Someone Else'), 'release-group': { id: id(8) } },
        { id: id(3), title: 'Lovescream', 'artist-credit': credit('Epik High'), 'release-group': { id: id(7) } },
        { id: id(4), title: 'Black Swan Songs (Repackage)', 'artist-credit': credit('에픽하이 Epik High'), 'release-group': { id: id(9) } },
      ],
    }, track);
    assert.deepEqual(releases, [coverArtArchive(id(1)), coverArtArchive(id(4)), coverArtArchive(id(9), 'release-group')]);
    // A recording search: a recording named like the track, the play's own album first
    const recordings = musicBrainzCovers('recording', {
      recordings: [
        { title: 'Paris (Live)', 'artist-credit': credit('Epik High'), releases: [{ id: id(5), title: 'Live 2010' }, { id: id(6), title: 'Black Swan Songs', 'release-group': { id: id(9) } }] },
        { title: 'Paris', 'artist-credit': credit('Someone Else'), releases: [{ id: id(3), title: 'Black Swan Songs' }] },
        { title: 'Paris', 'artist-credit': credit('Epik High'), releases: [{ id: 'not-an-id', title: 'Black Swan Songs' }] },
      ],
    }, track);
    assert.deepEqual(recordings, [coverArtArchive(id(6)), coverArtArchive(id(5)), coverArtArchive(id(9), 'release-group')]);
    assert.deepEqual(musicBrainzCovers('release', {}, track), []);
    assert.deepEqual(musicBrainzCovers('recording', { recordings: [{ title: 'Another Song', 'artist-credit': credit('Epik High'), releases: [{ id: id(1) }] }] }, track), []);
  });

  it('older plays (the alpha collection) keep their link, and say where they were played', () => {
    const t = trackOf({ trackName: 'One Summer Drive', artists: [{ artistName: 'Cool' }], originUrl: 'https://www.last.fm/music/Cool/_/One+Summer+Drive' }, false);
    assert.equal(t.trackUrl, 'https://www.last.fm/music/Cool/_/One+Summer+Drive');
    assert.equal(t.service, 'Last.fm');
    assert.equal(serviceOf('https://music.apple.com/id/album/x/1?i=2'), 'Apple Music');
    assert.equal(serviceOf('https://example.com/x'), '');
    assert.deepEqual(t.artists, ['Cool']);
  });

  it('an "older" token says which collection and where in it', () => {
    assert.deepEqual(parseOlder(olderToken(1, '3lzx2abcde')), { collection: 1, cursor: '3lzx2abcde' });
    assert.deepEqual(parseOlder('0-'), { collection: 0, cursor: '' });
    assert.equal(parseOlder('2-abc'), null);
    assert.equal(parseOlder('1-<script>'), null);
    assert.equal(parseOlder(null), null);
  });

  it('this week: plays in the last 7 days, top artists (each artist on a duet counts) and top tracks', () => {
    const at = (h) => now / 1000 - h * 3600;
    const p = (name, artists, h) => ({ ...trackOf({ trackName: name, artists: artists.map((artistName) => ({ artistName })) }, false), playedAt: at(h) });
    const plays = [
      p('Rabun Jauh', ['Bernadya'], 1),
      p('Rabun Jauh', ['Bernadya'], 2),
      p('Lebih Beruntung Sedikit', ['Bernadya', 'Pamungkas'], 3),
      p('Ruang Sendiri', ['Tulus'], 30),
      p('Old', ['Someone'], 24 * 8),
    ];
    const w = weekSummary(plays, now);
    assert.equal(w.plays, 4);
    assert.deepEqual(w.artists, [{ name: 'Bernadya', count: 3 }, { name: 'Pamungkas', count: 1 }, { name: 'Tulus', count: 1 }]);
    assert.deepEqual(w.tracks[0], { name: 'Rabun Jauh', artist: 'Bernadya', count: 2 });
    assert.equal(w.tracks.length, 3);
    assert.equal(weekSummary([], now).plays, 0);
  });

  it('covers only from Deezer’s image servers', () => {
    const link = 'https://cdn-images.dzcdn.net/images/cover/c1737907ef08a6a511dfbcc359826d37/250x250-000000-80-0-0.jpg';
    assert.equal(deezerCover(link), link);
    assert.equal(deezerCover('https://evil.example/images/cover/x.jpg'), '');
    assert.equal(deezerCover('http://cdn-images.dzcdn.net/images/cover/x.jpg'), '');
  });

  it('artwork only from Apple’s image servers, at the size asked for', () => {
    assert.equal(
      appleArtwork('https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/50/c0/x.rgb.jpg/100x100bb.jpg', 174),
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/50/c0/x.rgb.jpg/174x174bb.jpg',
    );
    assert.equal(appleArtwork('https://evil.example/100x100bb.jpg', 174), '');
    assert.equal(appleArtwork('http://is1-ssl.mzstatic.com/a/100x100bb.jpg', 174), '');
  });
});
