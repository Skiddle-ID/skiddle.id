// teal.fm's records as the music card and the sidebar show them (src/lib/teal.mjs): what's playing
// now, or else the last track played, and album art links for Apple Music tracks.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appleArtwork, appleTrack, recentTrack, trackOf } from '../src/lib/teal.mjs';

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

  it('artwork only from Apple’s image servers, at the size asked for', () => {
    assert.equal(
      appleArtwork('https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/50/c0/x.rgb.jpg/100x100bb.jpg', 174),
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/50/c0/x.rgb.jpg/174x174bb.jpg',
    );
    assert.equal(appleArtwork('https://evil.example/100x100bb.jpg', 174), '');
    assert.equal(appleArtwork('http://is1-ssl.mzstatic.com/a/100x100bb.jpg', 174), '');
  });
});
